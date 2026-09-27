import { useEffect, useState } from 'react';
import { ago, api, short, tok, zec, type Accrual, type Claim, type Redeem, type Sweep } from '../api';

export default function Activity({ tick, decimals }: { tick: number; decimals: number }) {
  const [sweeps, setSweeps] = useState<Sweep[]>([]);
  const [accruals, setAccruals] = useState<Accrual[]>([]);
  const [redeems, setRedeems] = useState<Redeem[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [tab, setTab] = useState<'sweeps' | 'epochs' | 'redeems' | 'claims'>('sweeps');
  useEffect(() => {
    api.sweeps().then(setSweeps).catch(() => {});
    api.accruals().then(setAccruals).catch(() => {});
    api.redeems().then(setRedeems).catch(() => {});
    api.claims().then(setClaims).catch(() => {});
  }, [tick]);

  return (
    <div className="card">
      <div className="tabs">
        <button className={tab === 'sweeps' ? 'on' : ''} onClick={() => setTab('sweeps')}>Fee sweeps</button>
        <button className={tab === 'epochs' ? 'on' : ''} onClick={() => setTab('epochs')}>Accrual epochs</button>
        <button className={tab === 'redeems' ? 'on' : ''} onClick={() => setTab('redeems')}>Redeems</button>
        <button className={tab === 'claims' ? 'on' : ''} onClick={() => setTab('claims')}>Claims</button>
      </div>
      <div className="tbl">
        {tab === 'sweeps' && (
          <table>
            <thead><tr><th>When</th><th className="num">SOL in</th><th className="num">ZEC out</th><th className="num">→ Floor</th><th className="num">→ Hold</th><th>Status</th><th>Tx</th></tr></thead>
            <tbody>
              {sweeps.length === 0 && <tr><td colSpan={7} className="muted">No sweeps yet.</td></tr>}
              {sweeps.map((w) => (
                <tr key={w.id}>
                  <td>{ago(w.created_at)}</td>
                  <td className="num">{(Number(w.sol_lamports) / 1e9).toFixed(4)}</td>
                  <td className="num">{zec(w.zec_raw, 4)}</td>
                  <td className="num gold">{zec(w.floor_raw, 4)}</td>
                  <td className="num">{zec(w.hold_raw, 4)}</td>
                  <td><span className={`status ${w.status}`}>{w.status}</span></td>
                  <td>{w.tx_sig ? <a className="mono" href={`https://solscan.io/tx/${w.tx_sig}`} target="_blank" rel="noreferrer">{short(w.tx_sig)}</a> : <span className="muted">–</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {tab === 'epochs' && (
          <table>
            <thead><tr><th>When</th><th className="num">Distributed</th><th className="num">Forfeited</th><th className="num">Eligible supply</th><th className="num">Holders</th></tr></thead>
            <tbody>
              {accruals.length === 0 && <tr><td colSpan={5} className="muted">No epochs yet.</td></tr>}
              {accruals.map((a) => (
                <tr key={a.id}>
                  <td>{ago(a.ts)}</td>
                  <td className="num">{zec(a.hold_in_raw, 5)}</td>
                  <td className="num">{zec(a.forfeited_raw, 5)}</td>
                  <td className="num">{tok(a.eligible_supply_raw, decimals)}</td>
                  <td className="num">{a.holders_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {tab === 'redeems' && (
          <table>
            <thead><tr><th>When</th><th>Wallet</th><th className="num">Burned</th><th className="num">ZEC paid</th><th>To</th><th>Status</th></tr></thead>
            <tbody>
              {redeems.length === 0 && <tr><td colSpan={6} className="muted">No redeems yet.</td></tr>}
              {redeems.map((r) => (
                <tr key={r.signature}>
                  <td>{ago(r.created_at)}</td>
                  <td className="mono">{short(r.wallet)}</td>
                  <td className="num">{tok(r.amount_raw, decimals)}</td>
                  <td className="num gold">{zec(r.payout_raw)}</td>
                  <td className="mono">{r.dest_kind ?? '–'} {short(r.dest_addr)}</td>
                  <td><span className={`status ${r.status}`}>{r.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {tab === 'claims' && (
          <table>
            <thead><tr><th>When</th><th>Wallet</th><th className="num">ZEC</th><th>To</th><th>Status</th></tr></thead>
            <tbody>
              {claims.length === 0 && <tr><td colSpan={5} className="muted">No claims yet.</td></tr>}
              {claims.map((c) => (
                <tr key={c.id}>
                  <td>{ago(c.created_at)}</td>
                  <td className="mono">{short(c.owner)}</td>
                  <td className="num gold">{zec(c.amount_raw)}</td>
                  <td className="mono">{c.dest_kind}</td>
                  <td><span className={`status ${c.status}`}>{c.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
