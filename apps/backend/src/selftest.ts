/**
 * Self-test of the protocol math with an isolated SQLite file. No network, no keys.
 * Run: npm run selftest
 */
import { rmSync } from 'node:fs';

process.env.DB_PATH = './data/selftest.db';
process.env.DRY_RUN = 'true';
process.env.ZEARN_MINT = 'So11111111111111111111111111111111111111112';
for (const f of ['./data/selftest.db', './data/selftest.db-wal', './data/selftest.db-shm']) rmSync(f, { force: true });

const { db, kvAdd, kvBig, kvSet, LEDGER } = await import('./db.js');
const { runAccrualEpoch, holderView, markClaimed } = await import('./holdpool.js');
const { previewRedeem } = await import('./vault.js');
const { parseMemo } = await import('./payout.js');
const { unlockFraction } = await import('./config.js');

let fails = 0;
const check = (name: string, ok: boolean, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
  if (!ok) fails++;
};
const near = (a: bigint, b: bigint, tol = 5n) => (a > b ? a - b : b - a) <= tol;
const ZEC = 100_000_000n;
const A = 'A1111111111111111111111111111111111111111111';
const B = 'B2222222222222222222222222222222222222222222';
const backdate = (owner: string, hours: number) =>
  db.prepare('UPDATE lots SET opened_at=? WHERE owner=?').run(new Date(Date.now() - hours * 3_600_000).toISOString(), owner);
const invariant = () => kvBig(LEDGER.floor) + kvBig(LEDGER.holdPending) + kvBig(LEDGER.holdOwed) + kvBig(LEDGER.payoutOwed);

// ---- unlock curve
check('unlock 15 min = 5%', unlockFraction(0.25) === 0.05);
check('unlock 45 min interpolates to 15%', Math.abs(unlockFraction(0.75) - 0.15) < 1e-9);
check('unlock 8 h = 100%', unlockFraction(8) === 1);
check('unlock 20 h stays 100%', unlockFraction(20) === 1);

// ---- redeem math: 2% of supply, 10 ZEC vault, 2% fee
const r = previewRedeem(20_000_000n * 1_000_000n, 1_000_000_000n * 1_000_000n, 10n * ZEC);
check('redeem gross = 0.2 ZEC', r.gross === 20_000_000n, r.gross.toString());
check('redeem fee = 0.004 ZEC', r.fee === 400_000n, r.fee.toString());
check('redeem payout = 0.196 ZEC', r.payout === 19_600_000n, r.payout.toString());

// ---- floor per token after a redeem: rises only by the fee, never by the burn itself
{
  const S = 1_000_000_000n * 1_000_000n;
  const V = 10n * ZEC;
  const n = 100_000_000n * 1_000_000n; // burn 10% of supply
  const { payout, fee } = previewRedeem(n, S, V);
  const before = Number(V) / Number(S);
  const after = Number(V - payout) / Number(S - n);
  const expected = Number(V - (V * n) / S + fee) / Number(S - n); // pure pro-rata leaves V/S unchanged; only the fee remains
  check('floor/token after redeem = before + fee share only', Math.abs(after - expected) < 1e-18, `${before} -> ${after}`);
  check('no-fee redeem would leave floor/token unchanged', Math.abs(Number(V - (V * n) / S) / Number(S - n) - before) < 1e-18);
  check('10% burn with 2% fee lifts floor/token by ~0.22%', Math.abs(after / before - 1 - 0.0022222) < 1e-5, `${((after / before - 1) * 100).toFixed(4)}%`);
}

// ---- memo parsing
check('memo SOL parses', parseMemo(`ZEARN:SOL:${'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'}`)?.kind === 'SOL');
check('memo ZEC t1 parses', parseMemo('ZEARN:ZEC:t1VJL2dPUyXK7avDRGoCK4n4wcmeoJ4CRBS')?.kind === 'ZEC');
check('memo ZEC u1 rejected while ALLOW_UNIFIED_ZEC=false', parseMemo('ZEARN:ZEC:u156jsaq8vqtca7sxfwmtkc2l3h5z027hdp5vf3npgkzqgt9njjd3z6lsmpwj5nq2cs63cy3jygwcgktac5yak5q68dcpp08hv5euspxuc924skujcpp57wmzzpvtg9gjvw3cnpfzwjlsm25h0x8gty7pp5edmgzyyd3rvl345husm9kmm') === null);
check('memo ZECSOL parses', parseMemo('ZEARN:ZECSOL:EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')?.kind === 'ZECSOL');
check('memo USDC parses', parseMemo('ZEARN:USDC:EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')?.kind === 'USDC');
check('memo NEAR account parses', parseMemo('ZEARN:NEAR:alice.near')?.kind === 'NEAR');
check('memo NEAR implicit account parses', parseMemo(`ZEARN:NEAR:${'ab'.repeat(32)}`)?.kind === 'NEAR');
check('memo NEAR bad account rejected', parseMemo('ZEARN:NEAR:Not A Near Account') === null);
check('memo with wrong prefix rejected', parseMemo('OTHER:SOL:EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v') === null);
check('memo garbage rejected', parseMemo('hello') === null);

// ---- hold pool: epoch 1 opens lots (A 1000, B 500 tokens)
const snap1 = new Map<string, bigint>([[A, 1000n * 1_000_000n], [B, 500n * 1_000_000n]]);
runAccrualEpoch(snap1);
check('epoch 1 opened two lots', (db.prepare('SELECT COUNT(*) c FROM lots WHERE closed=0').get() as { c: number }).c === 2);

// ---- 1 ZEC arrives, epoch 2 distributes 2/3 : 1/3
kvSet(LEDGER.floor, ZEC.toString()); // pretend the floor holds 1 ZEC too
kvAdd(LEDGER.holdPending, ZEC);
const inv0 = invariant();
runAccrualEpoch(snap1);
const a2 = BigInt(holderView(A).accruedRaw);
const b2 = BigInt(holderView(B).accruedRaw);
check('A accrued 2/3 ZEC', near(a2, 66_666_666n), a2.toString());
check('B accrued 1/3 ZEC', near(b2, 33_333_333n), b2.toString());
// the curve is linear from [0h,0%] to [15min,5%], so a lot a few ms old unlocks dust only
check('only dust claimable at age 0', BigInt(holderView(A).claimableRaw) < 1_000n, holderView(A).claimableRaw);
check('ledger invariant after distribution', near(invariant(), inv0), `${invariant()} vs ${inv0}`);

// ---- aging: A held 9 h (100%), B held 1 h (20%)
backdate(A, 9);
backdate(B, 1);
check('A claimable = all accrued at 9 h', BigInt(holderView(A).claimableRaw) === a2);
check('B claimable = 20% at 1 h', near(BigInt(holderView(B).claimableRaw), b2 / 5n, 10n), holderView(B).claimableRaw);

// ---- B sells half: LIFO cut, unvested part forfeited, vested-unclaimed kept as residual
const pendingBefore = kvBig(LEDGER.holdPending);
const snap2 = new Map<string, bigint>([[A, 1000n * 1_000_000n], [B, 250n * 1_000_000n]]);
runAccrualEpoch(snap2);
const removed = b2 / 2n; // accrual attached to the sold half
const vestedRemoved = removed / 5n; // 20% unlocked
const forfeited = kvBig(LEDGER.holdPending) - pendingBefore;
check('forfeit = 80% of the sold half accrual', near(forfeited, removed - vestedRemoved, 20n), `${forfeited} vs ${removed - vestedRemoved}`);
const vb = holderView(B);
check('B residual keeps the vested part', near(BigInt(vb.residualRaw), vestedRemoved, 20n), vb.residualRaw);
check('B lot amount halved', BigInt(vb.balanceRaw) === 250n * 1_000_000n);
check('ledger invariant after forfeit', near(invariant(), inv0), `${invariant()} vs ${inv0}`);

// ---- A claims everything: owed first, then confirmed paid (mirrors jobs/claims.ts)
const claimable = BigInt(holderView(A).claimableRaw);
db.exec('BEGIN');
markClaimed(A, claimable);
kvAdd(LEDGER.holdOwed, -claimable);
kvAdd(LEDGER.payoutOwed, claimable);
db.exec('COMMIT');
check('A claimable is 0 after claim', BigInt(holderView(A).claimableRaw) === 0n);
check('ledger unchanged while the payout is in flight or failed', near(invariant(), inv0), `${invariant()} vs ${inv0}`);
kvAdd(LEDGER.payoutOwed, -claimable); // payout confirmed
check('ledger drops by the claim once paid', near(invariant(), inv0 - claimable), `${invariant()} vs ${inv0 - claimable}`);
check('nothing left owed after a confirmed payout', kvBig(LEDGER.payoutOwed) === 0n);

// ---- forfeited ZEC is redistributed next epoch (A gets 1000/1250 of it)
const aBefore = BigInt(holderView(A).accruedRaw);
runAccrualEpoch(snap2);
const aGain = BigInt(holderView(A).accruedRaw) - aBefore;
check('forfeits redistributed pro-rata', near(aGain, (forfeited * 1000n) / 1250n, 20n), `${aGain} vs ${(forfeited * 1000n) / 1250n}`);

console.log(fails === 0 ? '\nALL PASS' : `\n${fails} FAILED`);
process.exit(fails === 0 ? 0 : 1);
