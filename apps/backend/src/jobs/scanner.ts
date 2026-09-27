/**
 * Burn scanner: finds redeem burns on-chain without relying on the website to submit the signature.
 *
 * getSignaturesForAddress(mint) returns every tx touching the mint, including all pump.fun trades,
 * but the RPC also returns each tx's memo, so only signatures whose memo starts with the ZEARN
 * prefix are parsed. Burns without a memo are not auto-detected; those users can still submit
 * the signature manually and are paid in SOL to the burning wallet.
 *
 * The scanner starts from "now" on first run (it records the newest finalized signature and skips
 * history). If the RPC can no longer resolve the cursor (pruned or dropped tx), the cursor is reset
 * and the next pass re-anchors; the website submission path covers anything in that gap.
 */
import { config } from '../config.js';
import { kvGet, kvSet } from '../db.js';
import { log } from '../log.js';
import { connection, mintPk } from '../solana.js';
import { getRedeem, submitRedeem } from './redeem.js';

const L = log('scanner');
const KEY = 'burn_scan_last_sig';

export async function scanBurnsOnce(): Promise<void> {
  const last = kvGet(KEY, '');
  let sigs;
  try {
    sigs = await connection.getSignaturesForAddress(mintPk(), { until: last || undefined, limit: 1000 }, 'finalized');
  } catch (e) {
    const msg = (e as Error).message;
    if (last && /not found/i.test(msg)) {
      L.warn(`cursor ${last.slice(0, 8)} no longer resolvable, re-anchoring on next pass`);
      kvSet(KEY, '');
      return;
    }
    throw e;
  }
  if (sigs.length === 0) return;
  if (!last) {
    kvSet(KEY, sigs[0].signature);
    L.info(`anchored at ${sigs[0].signature.slice(0, 8)} (history skipped)`);
    return;
  }
  const prefix = `${config.memoPrefix.toUpperCase()}:`;
  let found = 0;
  for (const s of [...sigs].reverse()) {
    if (s.err) continue;
    const memo = (s.memo ?? '').replace(/^\[\d+\]\s*/, '').toUpperCase();
    if (!memo.startsWith(prefix)) continue;
    if (getRedeem(s.signature)) continue;
    found++;
    submitRedeem(s.signature).catch((e) => L.warn('submit', s.signature.slice(0, 8), (e as Error).message));
  }
  kvSet(KEY, sigs[0].signature);
  L.info(`scanned ${sigs.length} signatures, ${found} burn(s) queued`);
}
