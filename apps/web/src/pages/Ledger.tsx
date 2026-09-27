import type { Data } from '../App';
import Activity from '../components/Activity';

export default function LedgerPage({ d }: { d: Data }) {
  const ok = d.sweeps.filter((w) => w.status === 'success');
  const solIn = ok.reduce((a, w) => a + Number(w.sol_lamports) / 1e9, 0);
  const zecOut = ok.reduce((a, w) => a + Number(w.zec_raw ?? 0) / 1e8, 0);
  return (
    <>
      <div className="eyebrow">Ledger</div>
      <h1 className="title">Everything the keeper does, <em>in public.</em></h1>
      <p className="lead">Sweeps, accrual epochs, redeems and claims as recorded by the backend. Cross-check sweeps against the vault wallet on Solscan and the ZEC balance on intents.near.</p>
      <div className="gap-lg" />
      <div className="strip">
        <div><small>Sweeps</small><b>{ok.length}</b><span>successful</span></div>
        <div><small>SOL swept</small><b>{solIn.toFixed(4)}</b><span>lifetime</span></div>
        <div><small>ZEC acquired</small><b className="gold">{zecOut.toFixed(4)}</b><span>lifetime</span></div>
        <div><small>Epochs</small><b>{d.accruals.length}</b><span>accrual runs</span></div>
        <div><small>Redeems</small><b>{d.redeems.length}</b><span>{d.redeems.filter((r) => r.status === 'paid').length} paid</span></div>
        <div><small>Claims</small><b>{d.claims.length}</b><span>{d.claims.filter((c) => c.status === 'paid').length} paid</span></div>
      </div>
      <div className="gap" />
      <Activity tick={0} decimals={d.s?.tokenDecimals ?? 6} />
    </>
  );
}
