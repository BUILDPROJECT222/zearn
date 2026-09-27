import { useState } from 'react';
import type { Data } from '../App';
import { ago } from '../api';
import { buildLog, SYSTEMS, systemStatus, type SystemId } from '../systems';

const FILTERS: { id: SystemId | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'keeper', label: 'Sweeps' },
  { id: 'bridge', label: 'Swaps' },
  { id: 'indexer', label: 'Epochs' },
  { id: 'pay', label: 'Payouts' },
  { id: 'arb', label: 'Arb' },
];

export default function ActivityLog({ d }: { d: Data }) {
  const [f, setF] = useState<SystemId | 'all'>('all');
  const log = buildLog(d.sweeps, d.accruals, d.redeems, d.claims, d.s).filter((e) => f === 'all' || e.who === f);
  const st = systemStatus(d.s, d.sweeps, d.accruals, d.redeems, d.claims);
  const byId = Object.fromEntries(SYSTEMS.map((m) => [m.id, m]));
  return (
    <div className="logwrap">
      <div className="panel">
        <h2>Keeper activity</h2>
        <div className="sub">Every action the backend takes, straight from the protocol ledger.</div>
        <div className="filters">
          {FILTERS.map((x) => (
            <button key={x.id} className={f === x.id ? 'on' : ''} onClick={() => setF(x.id)}>{x.label}</button>
          ))}
        </div>
        <div className="log">
          {log.length === 0 && <div className="note">Nothing logged yet. Once fees arrive, the sweeps show up here.</div>}
          {log.map((e, i) => {
            const m = byId[e.who];
            return (
              <div className="ev" key={i}>
                <span className="sysdot" style={{ background: m.color, boxShadow: `0 0 10px ${m.color}` }} />
                <div>
                  <div className="who">
                    <b style={{ color: m.color }}>{m.name}</b>
                    <span className="tag">{e.tag}</span>
                    <time>{ago(e.ts)}</time>
                    {e.ref && (e.refUrl ? <a href={e.refUrl} target="_blank" rel="noreferrer">{e.ref.slice(0, 4)}…{e.ref.slice(-4)}</a> : <a>{e.ref.slice(0, 8)}</a>)}
                  </div>
                  <p>{e.text}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="panel">
        <h2>Systems</h2>
        <div className="sub">{Object.values(st).filter((x) => x.status === 'working').length} of {SYSTEMS.length} active right now</div>
        <div className="duty">
          {SYSTEMS.map((m) => (
            <div key={m.id}>
              <span className="sysdot" style={{ background: m.color }} />
              <div><b>{m.name}</b><small>{m.desc}</small><small className="mono">{st[m.id].line}</small></div>
              <span className={`st ${st[m.id].status}`}>● {st[m.id].status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
