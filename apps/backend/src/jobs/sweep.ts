/**
 * Sweep: SOL creator fees in the vault wallet -> ZEC via 1Click -> treasury balance at intents.near.
 * Output is split: FLOOR_SPLIT_PCT to the Floor Vault, the rest to the Hold Pool (hold_pending).
 *
 * The sweep row is written before any SOL moves and updated at each step, so the recovery job can
 * credit a swap that completed while this process was down (see jobs/recovery.ts).
 */
import { config } from '../config.js';
import { db, kvAdd, kvSet, LEDGER, now } from '../db.js';
import { inflight } from '../inflight.js';
import { quoteSolToZec, setRefundSolAddress, submitDeposit, waitForSwap } from '../intents.js';
import { log } from '../log.js';
import { claimPumpCreatorFee, getSolBalanceLamports, lamportsToSol, sendSol, solToLamports, vaultKeypair } from '../solana.js';
import { invalidateVaultCache } from '../vault.js';

const L = log('sweep');

/** Credit a completed swap exactly once: the status transition is guarded in SQL. */
export function creditSweep(id: number, zecOut: bigint): boolean {
  const floor = (zecOut * BigInt(config.floorSplitBps)) / 10_000n;
  const hold = zecOut - floor;
  const res = db
    .prepare("UPDATE sweeps SET status='success', zec_raw=?, floor_raw=?, hold_raw=?, updated_at=? WHERE id=? AND status IN ('quoted','sent')")
    .run(zecOut.toString(), floor.toString(), hold.toString(), now(), id);
  if (Number(res.changes) !== 1) return false;
  kvAdd(LEDGER.floor, floor);
  kvAdd(LEDGER.holdPending, hold);
  kvSet(LEDGER.lastSweepAt, now());
  invalidateVaultCache();
  L.info(`sweep #${id} success: +${floor} raw floor, +${hold} raw hold`);
  return true;
}

export async function sweepOnce(): Promise<void> {
  const kp = vaultKeypair();
  setRefundSolAddress(kp.publicKey.toBase58());

  // never start a new sweep while an earlier one is unresolved (e.g. waiting on recovery after a restart)
  const open = db.prepare("SELECT COUNT(*) AS c FROM sweeps WHERE status IN ('quoted','sent')").get() as unknown as { c: number };
  if (!config.dryRun && open.c > 0) {
    L.info(`${open.c} sweep(s) still in flight, waiting for recovery`);
    return;
  }

  if (config.autoClaimPump) {
    try {
      await claimPumpCreatorFee();
    } catch (e) {
      L.warn('auto-claim failed (claim manually on pump.fun):', (e as Error).message);
    }
  }

  const bal = await getSolBalanceLamports(kp.publicKey);
  const avail = bal - solToLamports(config.solReserve);
  if (avail < solToLamports(config.minSweepSol)) {
    L.info(`balance ${lamportsToSol(bal).toFixed(4)} SOL, below sweep threshold`);
    return;
  }

  let toTreasury = avail;
  if (config.opsSolAddress && config.treasuryShareBps < 10_000) {
    const ops = (avail * BigInt(10_000 - config.treasuryShareBps)) / 10_000n;
    toTreasury = avail - ops;
    if (!config.dryRun && ops > 0n) {
      const sig = await sendSol(config.opsSolAddress, ops);
      L.info(`ops share ${lamportsToSol(ops)} SOL -> ${config.opsSolAddress} (${sig})`);
    }
  }

  const q = await quoteSolToZec(toTreasury, config.dryRun);
  const ts = now();
  const r = db
    .prepare('INSERT INTO sweeps(created_at,updated_at,sol_lamports,zec_raw,deposit_address,status,quote_json) VALUES(?,?,?,?,?,?,?)')
    .run(ts, ts, toTreasury.toString(), q.quote.amountOut, q.quote.depositAddress ?? null, config.dryRun ? 'dry' : 'quoted', JSON.stringify(q));
  const id = Number(r.lastInsertRowid);
  L.info(`quote: ${lamportsToSol(toTreasury)} SOL -> ${q.quote.amountOutFormatted} ZEC (${config.dryRun ? 'DRY RUN' : 'live'})`);
  if (config.dryRun) {
    kvSet(LEDGER.lastSweepAt, ts);
    return;
  }
  if (!q.quote.depositAddress) throw new Error('quote without depositAddress');

  inflight.sweeps.add(id);
  try {
    const sig = await sendSol(q.quote.depositAddress, BigInt(q.quote.amountIn));
    db.prepare("UPDATE sweeps SET status='sent', tx_sig=?, updated_at=? WHERE id=?").run(sig, now(), id);
    try {
      await submitDeposit(sig, q.quote.depositAddress);
    } catch (e) {
      L.warn('submitDeposit', (e as Error).message);
    }
    const st = await waitForSwap(q.quote.depositAddress);
    if (st.status !== 'SUCCESS') {
      db.prepare('UPDATE sweeps SET status=?, error=?, updated_at=? WHERE id=?').run(st.status.toLowerCase(), JSON.stringify(st.swapDetails ?? {}), now(), id);
      L.error(`sweep #${id} ${st.status}`);
      return;
    }
    creditSweep(id, BigInt(st.swapDetails?.amountOut ?? q.quote.amountOut));
  } finally {
    // on a crash or timeout the row stays quoted/sent and the recovery job resolves it against 1Click
    inflight.sweeps.delete(id);
  }
}
