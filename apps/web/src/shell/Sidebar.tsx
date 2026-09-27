import type { Data } from '../App';
import { SYSTEMS, systemStatus } from '../systems';

export type PageId = 'dashboard' | 'vault' | 'redeem' | 'hold' | 'how' | 'ledger' | 'risks';

const I = {
  dashboard: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /></svg>,
  vault: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="12" cy="12" r="3" /></svg>,
  redeem: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3c2 3 5 5 5 9a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3 0-5 1-8z" /></svg>,
  hold: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z" /></svg>,
  how: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .8-1 1.7M12 17h.01" /></svg>,
  ledger: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 4h14v16H5z" /><path d="M9 8h6M9 12h6M9 16h4" /></svg>,
  risks: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3l10 18H2z" /><path d="M12 10v5M12 18h.01" /></svg>,
};

const NAV: { id: PageId; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'vault', label: 'Vault' },
  { id: 'redeem', label: 'Redeem' },
  { id: 'hold', label: 'Hold' },
  { id: 'how', label: 'How it works' },
  { id: 'ledger', label: 'Ledger' },
  { id: 'risks', label: 'Risks & terms' },
];

export default function Sidebar({ page, go, d }: { page: PageId; go: (p: PageId) => void; d: Data }) {
  const st = systemStatus(d.s, d.sweeps, d.accruals, d.redeems, d.claims);
  const working = Object.values(st).filter((x) => x.status === 'working').length;
  return (
    <aside className="sidebar">
      <div className="logo"><i>Z</i>ZEARN</div>
      <div className="nav">
        {NAV.map((n) => (
          <a key={n.id} href={`#/${n.id}`} className={page === n.id ? 'on' : ''} onClick={(e) => { e.preventDefault(); go(n.id); }}>
            {I[n.id]}
            {n.label}
            {n.id === 'vault' && d.s && <span className={`tag ${d.s.dryRun ? 'warn' : ''}`}>{d.s.dryRun ? 'dry' : 'live'}</span>}
            {n.id === 'redeem' && d.s?.arbGapPct != null && d.s.arbGapPct > 0 && <span className="tag">arb</span>}
          </a>
        ))}
      </div>
      <div className="rollcall">
        <div className="head tiny"><span>Systems</span><span className="green">{working}/{SYSTEMS.length}</span></div>
        <div className="syslist">
          {SYSTEMS.map((m) => (
            <div key={m.id} title={st[m.id].line}>
              <i className={`dot ${st[m.id].status}`} />
              <span>{m.name}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="foot">$zearn · pump.fun · near intents · zcash</div>
    </aside>
  );
}
