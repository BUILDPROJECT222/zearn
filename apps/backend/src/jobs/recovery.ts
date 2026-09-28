/**
 * Recovery: resolves work interrupted by a restart, a crash or a timeout, using 1Click as the source of truth.
 * Runs at startup and then every minute.
 *
 * Sweeps (quoted/sent):   SUCCESS -> credit the ledger once; REFUNDED/FAILED -> mark; quoted and never
 *                         deposited past the quote deadline -> expired.
 * Payouts (paying):       no deposit recorded -> nothing was sent -> failed, safe to retry;
 *                         SUCCESS -> paid; REFUNDED -> failed, safe to retry (ZEC is back in the treasury);
 *                         deposit made but unresolved for too long -> failed, NOT auto-retried (manual review).
 * Retries:                failed + retry_safe + attempts < 3, at most one pass every 5 minutes per row.
 */
import { config } from '../config.js';
import { db, now } from '../db.js';
import { inflight } from '../inflight.js';
import { getSwapStatus, type SwapStatus } from '../intents.js';
import { log } from '../log.js';
import { creditSweep } from './sweep.js';
import { getPayoutRow, parseRef, runPayout, settlePaid, updatePayoutRow, type PayoutTable } from './payouts.js';

const L = log('recovery');

/** Swappable for tests. */
export const recoveryDeps = { getSwapStatus: getSwapStatus as (dep: string) => Promise<SwapStatus> };

const MIN = 60_000;
const age = (iso: string) => Date.now() - Date.parse(iso);
export const MAX_ATTEMPTS = 3;

export async function recoverOnce(): Promise<{ sweeps: number; payouts: number; retries: number }> {
  const out = { sweeps: 0, payouts: 0, retries: 0 };
  if (config.dryRun) return out;

  // ---- sweeps ----
  const sweeps = db.prepare("SELECT id, status, deposit_address, created_at FROM sweeps WHERE status IN ('quoted','sent')").all() as unknown as {
    id: number;
    status: string;
    deposit_address: string | null;
    created_at: string;
  }[];
  for (const s of sweeps) {
    if (inflight.sweeps.has(s.id) || age(s.created_at) < MIN) continue;
    if (!s.deposit_address) {
      db.prepare("UPDATE sweeps SET status='expired', error=?, updated_at=? WHERE id=?").run('no deposit address recorded', now(), s.id);
      continue;
    }
    let st: SwapStatus;
    try {
      st = await recoveryDeps.getSwapStatus(s.deposit_address);
    } catch (e) {
      L.warn(`sweep #${s.id} status lookup failed:`, (e as Error).message);
      continue;
    }
    if (st.status === 'SUCCESS' && st.swapDetails?.amountOut) {
      if (creditSweep(s.id, BigInt(st.swapDetails.amountOut))) {
        out.sweeps++;
        L.info(`sweep #${s.id} recovered: credited ${st.swapDetails.amountOut} raw ZEC`);
      }
    } else if (st.status === 'REFUNDED' || st.status === 'FAILED') {
      db.prepare('UPDATE sweeps SET status=?, error=?, updated_at=? WHERE id=?').run(st.status.toLowerCase(), 'resolved by recovery', now(), s.id);
      out.sweeps++;
    } else if (st.status === 'PENDING_DEPOSIT' && s.status === 'quoted' && age(s.created_at) > 35 * MIN) {
      // quote expired and no SOL ever arrived: nothing to credit
      db.prepare("UPDATE sweeps SET status='expired', error=?, updated_at=? WHERE id=?").run('quote expired without a deposit', now(), s.id);
      out.sweeps++;
    }
  }

  // ---- payouts stuck in "paying" ----
  for (const t of ['redeems', 'claims'] as PayoutTable[]) {
    const key = t === 'redeems' ? 'signature' : 'id';
    const inf = (t === 'redeems' ? inflight.redeems : inflight.claims) as Set<string | number>;
    const rows = db.prepare(`SELECT ${key} AS k FROM ${t} WHERE status='paying'`).all() as unknown as { k: string | number }[];
    for (const { k } of rows) {
      if (inf.has(k)) continue;
      const row = getPayoutRow(t, k)!;
      if (age(row.updated_at) < 2 * MIN) continue;
      const { dep, hash } = parseRef(row.payout_ref);
      if (!dep) {
        updatePayoutRow(t, k, { status: 'failed', retry_safe: 1, error: 'interrupted before a 1Click order existed; nothing was sent' });
        out.payouts++;
        continue;
      }
      let st: SwapStatus;
      try {
        st = await recoveryDeps.getSwapStatus(dep);
      } catch (e) {
        L.warn(`${t} ${String(k).slice(0, 8)} status lookup failed:`, (e as Error).message);
        continue;
      }
      if (st.status === 'SUCCESS') {
        if (settlePaid(t, k, row.payout_ref)) out.payouts++;
      } else if (st.status === 'REFUNDED') {
        updatePayoutRow(t, k, { status: 'failed', retry_safe: 1, error: '1Click refunded the order to the treasury' });
        out.payouts++;
      } else if (st.status === 'PENDING_DEPOSIT' && !hash && age(row.updated_at) > 35 * MIN) {
        updatePayoutRow(t, k, { status: 'failed', retry_safe: 1, error: 'order expired before the ZEC was sent' });
        out.payouts++;
      } else if ((st.status === 'FAILED' || st.status === 'INCOMPLETE_DEPOSIT') || age(row.updated_at) > 60 * MIN) {
        // funds may have moved: never auto-retry, surface for a human
        updatePayoutRow(t, k, { status: 'failed', retry_safe: 0, error: `needs review: 1Click status ${st.status}` });
        out.payouts++;
      }
    }
  }

  // ---- safe automatic retries ----
  for (const t of ['redeems', 'claims'] as PayoutTable[]) {
    const key = t === 'redeems' ? 'signature' : 'id';
    const rows = db
      .prepare(`SELECT ${key} AS k, updated_at FROM ${t} WHERE status='failed' AND retry_safe=1 AND attempts < ? ORDER BY updated_at LIMIT 5`)
      .all(MAX_ATTEMPTS) as unknown as { k: string | number; updated_at: string }[];
    for (const r of rows) {
      if (age(r.updated_at) < 5 * MIN) continue;
      L.info(`retrying ${t} ${String(r.k).slice(0, 8)}`);
      await runPayout(t, r.k);
      out.retries++;
    }
  }

  if (out.sweeps || out.payouts || out.retries) L.info(`recovered: ${out.sweeps} sweep(s), ${out.payouts} payout(s), ${out.retries} retr(ies)`);
  return out;
}
