/**
 * Human-friendly payout status for redeems and claims.
 * A failed payout that is safe to retry is shown as "retrying" (the keeper retries it automatically, up to 3 times);
 * one that needs review says so. Raw RPC errors are never shown to users.
 */
type Row = { status: string; attempts?: number | null; retry_safe?: number | null; error?: string | null };
const MAX_ATTEMPTS = 3;

export function payoutView(r: Row): { cls: string; label: string; note: string | null } {
  const attempts = Number(r.attempts ?? 0);
  if (r.status === 'failed' && Number(r.retry_safe ?? 0) === 1 && attempts < MAX_ATTEMPTS)
    return { cls: 'paying', label: 'retrying', note: `Payout is retrying automatically (attempt ${attempts} of ${MAX_ATTEMPTS} failed). Your ZEC is safe in the treasury.` };
  if (r.status === 'failed')
    return { cls: 'failed', label: 'under review', note: 'The team is reviewing this payout. Your ZEC stays owed to you in the treasury.' };
  if (r.status === 'paying') return { cls: 'paying', label: 'paying', note: 'Swapping and sending your payout, usually under a minute.' };
  if (r.status === 'pending') return { cls: 'pending', label: 'pending', note: 'Waiting for the burn to finalize on Solana.' };
  if (r.status === 'rejected') return { cls: 'rejected', label: 'rejected', note: r.error ?? null };
  return { cls: r.status, label: r.status, note: null };
}

export default function PayoutStatus({ r, withNote = false }: { r: Row; withNote?: boolean }) {
  const v = payoutView(r);
  return (
    <>
      <span className={`status ${v.cls}`}>{v.label}</span>
      {withNote && v.note && <div className="note">{v.note}</div>}
    </>
  );
}
