/**
 * Shared payout runner for redeems and hold claims.
 *
 * Ledger rule: the amount sits in payout_owed from the moment it is committed until 1Click confirms delivery.
 * Every step is persisted (status, attempts, payout_ref = "1click:<depositAddress>:<nearTxHash>") so the
 * recovery job can finish or safely retry anything interrupted by a restart.
 */
import { db, kvAdd, LEDGER, now } from '../db.js';
import { inflight } from '../inflight.js';
import { log } from '../log.js';
import { executePayout, type DestKind } from '../payout.js';
import { invalidateVaultCache } from '../vault.js';

const L = log('payout');

/** Swappable for tests. */
export const payoutDeps = { executePayout };

export type PayoutTable = 'redeems' | 'claims';
const KEY: Record<PayoutTable, string> = { redeems: 'signature', claims: 'id' };
const AMOUNT: Record<PayoutTable, string> = { redeems: 'payout_raw', claims: 'amount_raw' };
const setFor = (t: PayoutTable) => (t === 'redeems' ? inflight.redeems : inflight.claims) as Set<string | number>;

export type PayoutRow = {
  key: string | number;
  amount: bigint;
  dest_kind: string;
  dest_addr: string;
  status: string;
  payout_ref: string | null;
  attempts: number;
  retry_safe: number;
  updated_at: string;
};

export function getPayoutRow(t: PayoutTable, key: string | number): PayoutRow | undefined {
  const r = db.prepare(`SELECT *, ${KEY[t]} AS k, ${AMOUNT[t]} AS amt FROM ${t} WHERE ${KEY[t]}=?`).get(key) as unknown as
    | (Record<string, unknown> & { k: string | number; amt: string })
    | undefined;
  if (!r) return undefined;
  return {
    key: r.k,
    amount: BigInt(r.amt ?? '0'),
    dest_kind: String(r.dest_kind),
    dest_addr: String(r.dest_addr),
    status: String(r.status),
    payout_ref: (r.payout_ref as string | null) ?? null,
    attempts: Number(r.attempts ?? 0),
    retry_safe: Number(r.retry_safe ?? 0),
    updated_at: String(r.updated_at),
  };
}

export function updatePayoutRow(t: PayoutTable, key: string | number, fields: Record<string, string | number | null>) {
  const cols = Object.keys(fields);
  db.prepare(`UPDATE ${t} SET updated_at=? ${cols.map((c) => `, ${c}=?`).join('')} WHERE ${KEY[t]}=?`).run(now(), ...cols.map((c) => fields[c]), key);
}

/** "1click:<dep>:<hash>" -> parts; hash is empty until the ZEC has been sent */
export function parseRef(ref: string | null): { dep: string | null; hash: string | null } {
  if (!ref || !ref.startsWith('1click:')) return { dep: null, hash: null };
  const [, dep, hash] = ref.split(':');
  return { dep: dep || null, hash: hash || null };
}

/**
 * Mark a payout delivered exactly once (status transition guarded in SQL), releasing it from payout_owed.
 * Returns false if another path already settled it.
 */
export function settlePaid(t: PayoutTable, key: string | number, ref: string | null): boolean {
  const row = getPayoutRow(t, key);
  if (!row) return false;
  const res = db
    .prepare(`UPDATE ${t} SET status='paid', payout_ref=COALESCE(?, payout_ref), error=NULL, updated_at=? WHERE ${KEY[t]}=? AND status IN ('paying','failed')`)
    .run(ref, now(), key);
  if (Number(res.changes) !== 1) return false;
  kvAdd(LEDGER.payoutOwed, -row.amount);
  invalidateVaultCache();
  return true;
}

/** Run (or re-run) the 1Click payout for a committed row. The amount must already be in payout_owed. */
export async function runPayout(t: PayoutTable, key: string | number): Promise<void> {
  const inf = setFor(t);
  if (inf.has(key)) return;
  const row = getPayoutRow(t, key);
  if (!row || row.amount <= 0n) return;
  inf.add(key);
  try {
    updatePayoutRow(t, key, { status: 'paying', attempts: row.attempts + 1, payout_ref: null, retry_safe: 0, error: null });
    let lastRef: string | null = null;
    try {
      const ref = await payoutDeps.executePayout(row.dest_kind as DestKind, row.dest_addr, row.amount, (r) => {
        lastRef = r;
        updatePayoutRow(t, key, { payout_ref: r });
      });
      settlePaid(t, key, ref);
      L.info(`${t} ${String(key).slice(0, 8)} paid ${row.amount} raw -> ${row.dest_kind}`);
    } catch (e) {
      // safe to retry only if the ZEC never left the treasury (no NEAR transfer hash recorded)
      const safe = parseRef(lastRef).hash ? 0 : 1;
      updatePayoutRow(t, key, { status: 'failed', retry_safe: safe, error: (e as Error).message.slice(0, 500) });
      L.error(`${t} ${String(key).slice(0, 8)} payout failed (retry_safe=${safe}):`, (e as Error).message);
    }
  } finally {
    inf.delete(key);
  }
}
