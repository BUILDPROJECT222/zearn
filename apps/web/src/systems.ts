import { ago, zec, type Accrual, type Claim, type Redeem, type Sweep, type VaultState } from './api';

export type SystemId = 'keeper' | 'bridge' | 'indexer' | 'arb' | 'pay';
export type System = { id: SystemId; name: string; desc: string; color: string };

/** The real backend modules. Every ledger row is produced by one of these. */
export const SYSTEMS: System[] = [
  { id: 'keeper', name: 'Fee sweep', desc: 'Claims creator fees and sweeps the SOL every epoch.', color: '#f4b728' },
  { id: 'bridge', name: 'Intents bridge', desc: 'Swaps SOL → ZEC through NEAR Intents 1Click.', color: '#6ea8fe' },
  { id: 'indexer', name: 'Hold indexer', desc: 'Snapshots holders, opens lots, accrues rewards, cuts LIFO on sells.', color: '#3ee38a' },
  { id: 'arb', name: 'Arb watcher', desc: 'Compares market cap with the effective floor.', color: '#ff6b61' },
  { id: 'pay', name: 'Payouts', desc: 'Pays redeems and claims to a ZEC t-addr or swaps to SOL.', color: '#c98bff' },
];

export type SystemStatus = { status: 'working' | 'watching' | 'idle'; line: string };

export function systemStatus(s: VaultState | null, sweeps: Sweep[], accruals: Accrual[], redeems: Redeem[], claims: Claim[]): Record<SystemId, SystemStatus> {
  const fresh = (iso: string | null | undefined, mult = 2) => !!iso && Date.now() - Date.parse(iso) < (s?.params.sweepIntervalSec ?? 300) * 1000 * mult;
  const paid = redeems.filter((r) => r.status === 'paid' || r.status === 'verified').length + claims.filter((c) => c.status === 'paid' || c.status === 'dry').length;
  const inflight = sweeps.some((w) => w.status === 'sent' || w.status === 'quoted');
  const arb = s?.arbGapPct ?? null;
  return {
    keeper: fresh(s?.lastSweepAt) ? { status: 'working', line: `last sweep ${ago(s!.lastSweepAt)}` } : { status: 'idle', line: s?.lastSweepAt ? `last sweep ${ago(s.lastSweepAt)}` : 'waiting for fees' },
    bridge: inflight ? { status: 'working', line: 'swap in flight' } : { status: 'watching', line: `${sweeps.filter((w) => w.status === 'success').length} swaps settled` },
    indexer: fresh(s?.lastAccrualAt) ? { status: 'working', line: `epoch ${ago(s!.lastAccrualAt)} · ${accruals[0]?.holders_count ?? 0} holders` } : { status: 'idle', line: 'no epoch yet' },
    arb: s && s.floorZec <= 0 ? { status: 'idle', line: 'vault empty, no floor yet' } : arb === null ? { status: 'idle', line: 'no market data' } : arb > 0 ? { status: 'working', line: `arb open +${arb.toFixed(1)}%` } : { status: 'watching', line: `gap ${arb.toFixed(1)}%` },
    pay: { status: paid > 0 ? 'working' : 'watching', line: `${paid} payouts` },
  };
}

export type LogEvent = { ts: string; who: SystemId; tag: string; text: string; ref?: string; refUrl?: string };

export function buildLog(sweeps: Sweep[], accruals: Accrual[], redeems: Redeem[], claims: Claim[], s: VaultState | null): LogEvent[] {
  const ev: LogEvent[] = [];
  for (const w of sweeps) {
    const sol = (Number(w.sol_lamports) / 1e9).toFixed(4);
    if (w.status === 'success')
      ev.push({ ts: w.created_at, who: 'bridge', tag: 'swap', text: `Swapped ${sol} SOL → ${zec(w.zec_raw, 4)} ZEC. ${zec(w.floor_raw, 4)} to the floor, ${zec(w.hold_raw, 4)} to the hold pool.`, ref: w.tx_sig ?? undefined, refUrl: w.tx_sig ? `https://solscan.io/tx/${w.tx_sig}` : undefined });
    else if (w.status === 'dry') ev.push({ ts: w.created_at, who: 'keeper', tag: 'dry run', text: `Quoted ${sol} SOL → ${zec(w.zec_raw, 4)} ZEC. Nothing sent (DRY_RUN).` });
    else ev.push({ ts: w.created_at, who: 'keeper', tag: w.status, text: `Sweep of ${sol} SOL is ${w.status}.` });
  }
  let emptyEpochShown = false;
  for (const a of accruals) {
    if (a.holders_count === 0 && Number(a.hold_in_raw) === 0) {
      if (emptyEpochShown) continue; // collapse repeated empty epochs, keep the latest
      emptyEpochShown = true;
    }
    const dist = Number(a.hold_in_raw) / 1e8;
    const forf = Number(a.forfeited_raw) / 1e8;
    ev.push({
      ts: a.ts,
      who: 'indexer',
      tag: 'epoch',
      text: a.holders_count === 0 ? 'Snapshot ran: no eligible holders yet.' : `Distributed ${dist.toFixed(5)} ZEC across ${a.holders_count} holders${forf > 0 ? `; ${forf.toFixed(5)} ZEC forfeited by early sellers went back to the pool` : ''}.`,
    });
  }
  for (const r of redeems) {
    ev.push({
      ts: r.created_at,
      who: 'pay',
      tag: r.status,
      text: r.payout_raw ? `Burn of ${(Number(r.amount_raw) / 10 ** (s?.tokenDecimals ?? 6)).toLocaleString('en-US', { maximumFractionDigits: 0 })} ZEARN → ${zec(r.payout_raw)} ZEC to ${r.dest_kind}.` : `Redeem ${r.status}${r.error ? `: ${r.error}` : ''}.`,
      ref: r.signature,
      refUrl: `https://solscan.io/tx/${r.signature}`,
    });
  }
  for (const c of claims) ev.push({ ts: c.created_at, who: 'pay', tag: c.status, text: `Hold claim of ${zec(c.amount_raw)} ZEC to ${c.dest_kind} is ${c.status}.` });
  if (s?.arbGapPct != null && s.arbGapPct > 0) ev.push({ ts: new Date().toISOString(), who: 'arb', tag: 'alert', text: `Arbitrage open: buy at market, burn for +${s.arbGapPct.toFixed(1)}%.` });
  return ev.sort((a, b) => Date.parse(b.ts) - Date.parse(a.ts)).slice(0, 60);
}

/** $0.0₅9268 style price */
export function fmtPrice(p: number): string {
  if (!p) return '–';
  if (p >= 0.01) return `$${p.toFixed(4)}`;
  const str = p.toFixed(12);
  const m = str.match(/^0\.(0*)(\d+)/);
  if (!m) return `$${p}`;
  const zeros = m[1].length;
  const digits = m[2].replace(/0+$/, '').slice(0, 4);
  const sub = String(zeros).replace(/\d/g, (d) => '₀₁₂₃₄₅₆₇₈₉'[Number(d)]);
  return `$0.0${sub}${digits}`;
}
