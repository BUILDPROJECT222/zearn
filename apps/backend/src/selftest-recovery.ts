/**
 * Recovery self-test: simulates restarts in the middle of sweeps and payouts with a mocked 1Click.
 * Isolated SQLite file, live mode (DRY_RUN=false), no network, no keys.
 * Run: npm run selftest
 */
import { rmSync } from 'node:fs';

process.env.DB_PATH = './data/selftest-recovery.db';
process.env.DRY_RUN = 'false';
process.env.ZEARN_MINT = 'So11111111111111111111111111111111111111112';
process.env.FLOOR_SPLIT_PCT = '50';
for (const f of ['', '-wal', '-shm']) rmSync(`./data/selftest-recovery.db${f}`, { force: true });

const { db, kvAdd, kvBig, LEDGER } = await import('./db.js');
const { recoverOnce, recoveryDeps, MAX_ATTEMPTS } = await import('./jobs/recovery.js');
const { payoutDeps, runPayout } = await import('./jobs/payouts.js');
type SwapStatus = Awaited<ReturnType<typeof recoveryDeps.getSwapStatus>>;

let fails = 0;
const check = (name: string, ok: boolean, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
  if (!ok) fails++;
};
const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
const ledger = () => kvBig(LEDGER.floor) + kvBig(LEDGER.holdPending) + kvBig(LEDGER.holdOwed) + kvBig(LEDGER.payoutOwed);
const st = (table: string, key: string, val: string | number) => (db.prepare(`SELECT * FROM ${table} WHERE ${key}=?`).get(val) as unknown as {
  status: string;
  retry_safe: number;
  attempts: number;
  payout_ref: string | null;
});

// mocked 1Click: deposit address -> status
const swaps = new Map<string, SwapStatus>();
recoveryDeps.getSwapStatus = async (dep: string) => swaps.get(dep) ?? { status: 'PENDING_DEPOSIT' };
let payCalls = 0;
let payMode: 'ok' | 'fail-before-send' | 'fail-after-send' = 'ok';
payoutDeps.executePayout = async (_k, _a, _z, onProgress) => {
  payCalls++;
  onProgress?.('1click:DEPRETRY:');
  if (payMode === 'fail-before-send') throw new Error('quote failed');
  onProgress?.('1click:DEPRETRY:HASH1');
  if (payMode === 'fail-after-send') throw new Error('timeout after send');
  return '1click:DEPRETRY:HASH1';
};

const insSweep = db.prepare('INSERT INTO sweeps(created_at,updated_at,sol_lamports,zec_raw,deposit_address,status) VALUES(?,?,?,?,?,?)');

// ---- 1. sweep sent before a restart, 1Click completed it meanwhile
insSweep.run(ago(3), ago(3), '100000000', '900000', 'DEP1', 'sent');
swaps.set('DEP1', { status: 'SUCCESS', swapDetails: { amountOut: '1000000' } });
await recoverOnce();
check('interrupted sweep is credited from the 1Click result', kvBig(LEDGER.floor) === 500000n && kvBig(LEDGER.holdPending) === 500000n, `floor ${kvBig(LEDGER.floor)}`);
check('sweep row marked success with the real output', st('sweeps', 'deposit_address', 'DEP1').status === 'success');
await recoverOnce();
check('a second recovery pass does not credit it again', kvBig(LEDGER.floor) === 500000n);

// ---- 2. sweep quoted, SOL never sent, quote expired
insSweep.run(ago(40), ago(40), '100000000', '900000', 'DEP2', 'quoted');
await recoverOnce();
check('expired quote with no deposit is closed without credit', st('sweeps', 'deposit_address', 'DEP2').status === 'expired' && kvBig(LEDGER.floor) === 500000n);

// ---- 3. claim interrupted before any 1Click order: safe to retry, then retried and paid
kvAdd(LEDGER.holdOwed, 300000n);
kvAdd(LEDGER.holdOwed, -200000n); // committed claim
kvAdd(LEDGER.payoutOwed, 200000n);
const before3 = ledger();
db.prepare("INSERT INTO claims(created_at,updated_at,owner,amount_raw,dest_kind,dest_addr,status,attempts) VALUES(?,?,?,?,?,?,?,1)").run(ago(3), ago(3), 'OWNER', '200000', 'SOL', 'WALLET', 'paying');
const claimId = Number((db.prepare('SELECT MAX(id) AS id FROM claims').get() as unknown as { id: number }).id);
await recoverOnce();
let c = st('claims', 'id', claimId);
check('claim with no order is failed and flagged safe to retry', c.status === 'failed' && c.retry_safe === 1);
check('ledger unchanged: the claim is still owed', ledger() === before3 && kvBig(LEDGER.payoutOwed) === 200000n);
db.prepare('UPDATE claims SET updated_at=? WHERE id=?').run(ago(6), claimId);
payMode = 'ok';
await recoverOnce();
c = st('claims', 'id', claimId);
check('safe claim is retried automatically and paid', c.status === 'paid' && c.attempts === 2, `status ${c.status}, attempts ${c.attempts}`);
check('paid claim leaves payout_owed', kvBig(LEDGER.payoutOwed) === 0n && ledger() === before3 - 200000n);

// ---- 4. redeem whose ZEC was sent before the restart, 1Click delivered it
kvAdd(LEDGER.payoutOwed, 150000n);
db.prepare("INSERT INTO redeems(signature,created_at,updated_at,payout_raw,dest_kind,dest_addr,status,payout_ref,attempts) VALUES(?,?,?,?,?,?,?,?,1)").run('SIG4', ago(3), ago(3), '150000', 'SOL', 'WALLET', 'paying', '1click:DEP4:HASH4');
swaps.set('DEP4', { status: 'SUCCESS' });
const calls4 = payCalls;
await recoverOnce();
check('delivered redeem is settled as paid without paying again', st('redeems', 'signature', 'SIG4').status === 'paid' && payCalls === calls4);
check('settled redeem leaves payout_owed exactly once', kvBig(LEDGER.payoutOwed) === 0n);
await recoverOnce();
check('no double release on a second pass', kvBig(LEDGER.payoutOwed) === 0n);

// ---- 5. redeem sent but stuck at 1Click for over an hour: needs a human, never auto-retried
kvAdd(LEDGER.payoutOwed, 90000n);
db.prepare("INSERT INTO redeems(signature,created_at,updated_at,payout_raw,dest_kind,dest_addr,status,payout_ref,attempts) VALUES(?,?,?,?,?,?,?,?,1)").run('SIG5', ago(70), ago(70), '90000', 'SOL', 'WALLET', 'paying', '1click:DEP5:HASH5');
swaps.set('DEP5', { status: 'PROCESSING' });
const calls5 = payCalls;
await recoverOnce();
db.prepare("UPDATE redeems SET updated_at=? WHERE signature='SIG5'").run(ago(10));
await recoverOnce();
const r5 = st('redeems', 'signature', 'SIG5');
check('stuck sent redeem is flagged for review, not retried', r5.status === 'failed' && r5.retry_safe === 0 && payCalls === calls5);
check('its ZEC stays owed in the ledger', kvBig(LEDGER.payoutOwed) === 90000n);

// ---- 6. a payout that fails after the ZEC left the treasury is never retried automatically
db.prepare("INSERT INTO redeems(signature,created_at,updated_at,payout_raw,dest_kind,dest_addr,status,attempts) VALUES(?,?,?,?,?,?,?,0)").run('SIG6', ago(1), ago(1), '80000', 'SOL', 'WALLET', 'paying');
kvAdd(LEDGER.payoutOwed, 80000n);
payMode = 'fail-after-send';
await runPayout('redeems', 'SIG6');
check('failure after send is marked not safe to retry', st('redeems', 'signature', 'SIG6').retry_safe === 0);
payMode = 'fail-before-send';
db.prepare("INSERT INTO redeems(signature,created_at,updated_at,payout_raw,dest_kind,dest_addr,status,attempts) VALUES(?,?,?,?,?,?,?,0)").run('SIG7', ago(1), ago(1), '70000', 'SOL', 'WALLET', 'paying');
kvAdd(LEDGER.payoutOwed, 70000n);
await runPayout('redeems', 'SIG7');
check('failure before send is marked safe to retry', st('redeems', 'signature', 'SIG7').retry_safe === 1);

// ---- 7. retries stop after MAX_ATTEMPTS
for (let i = 0; i < MAX_ATTEMPTS + 2; i++) {
  db.prepare("UPDATE redeems SET updated_at=? WHERE signature='SIG7'").run(ago(6));
  await recoverOnce();
}
const r7 = st('redeems', 'signature', 'SIG7');
check(`retries stop at ${MAX_ATTEMPTS} attempts`, r7.attempts === MAX_ATTEMPTS && r7.status === 'failed', `attempts ${r7.attempts}`);

console.log(fails === 0 ? '\nALL PASS' : `\n${fails} FAILED`);
process.exit(fails === 0 ? 0 : 1);
