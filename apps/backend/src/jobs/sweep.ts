/**
 * Sweep: SOL creator fees in the vault wallet -> ZEC via 1Click -> treasury balance at intents.near.
 * Output is split: FLOOR_SPLIT_PCT to the Floor Vault, the rest to the Hold Pool (hold_pending).
 */
import { config } from '../config.js';
import { db, kvAdd, kvSet, LEDGER, now } from '../db.js';
import { quoteSolToZec, setRefundSolAddress, submitDeposit, waitForSwap } from '../intents.js';
import { log } from '../log.js';
import { claimPumpCreatorFee, getSolBalanceLamports, lamportsToSol, sendSol, solToLamports, vaultKeypair } from '../solana.js';
import { invalidateVaultCache } from '../vault.js';

const L = log('sweep');

export async function sweepOnce(): Promise<void> {
  const kp = vaultKeypair();
  setRefundSolAddress(kp.publicKey.toBase58());

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
  const ins = db.prepare(
    'INSERT INTO sweeps(created_at,updated_at,sol_lamports,zec_raw,deposit_address,status,quote_json) VALUES(?,?,?,?,?,?,?)',
  );
  const r = ins.run(ts, ts, toTreasury.toString(), q.quote.amountOut, q.quote.depositAddress ?? null, config.dryRun ? 'dry' : 'quoted', JSON.stringify(q));
  const id = Number(r.lastInsertRowid);
  L.info(`quote: ${lamportsToSol(toTreasury)} SOL -> ${q.quote.amountOutFormatted} ZEC (${config.dryRun ? 'DRY RUN' : 'live'})`);
  if (config.dryRun) {
    kvSet(LEDGER.lastSweepAt, ts);
    return;
  }
  if (!q.quote.depositAddress) throw new Error('quote without depositAddress');

  const upd = (status: string, extra: Record<string, string | null> = {}) => {
    const cols = Object.keys(extra);
    db.prepare(`UPDATE sweeps SET status=?, updated_at=? ${cols.map((c) => `, ${c}=?`).join('')} WHERE id=?`).run(
      status,
      now(),
      ...cols.map((c) => extra[c]),
      id,
    );
  };

  const sig = await sendSol(q.quote.depositAddress, BigInt(q.quote.amountIn));
  upd('sent', { tx_sig: sig });
  try {
    await submitDeposit(sig, q.quote.depositAddress);
  } catch (e) {
    L.warn('submitDeposit', (e as Error).message);
  }
  const st = await waitForSwap(q.quote.depositAddress);
  if (st.status !== 'SUCCESS') {
    upd(st.status.toLowerCase(), { error: JSON.stringify(st.swapDetails ?? {}) });
    L.error(`sweep #${id} ${st.status}`);
    return;
  }
  const zec = BigInt(st.swapDetails?.amountOut ?? q.quote.amountOut);
  const floor = (zec * BigInt(config.floorSplitBps)) / 10_000n;
  const hold = zec - floor;
  kvAdd(LEDGER.floor, floor);
  kvAdd(LEDGER.holdPending, hold);
  kvSet(LEDGER.lastSweepAt, now());
  upd('success', { zec_raw: zec.toString(), floor_raw: floor.toString(), hold_raw: hold.toString() });
  invalidateVaultCache();
  L.info(`sweep #${id} success: +${floor} raw floor, +${hold} raw hold`);
}
