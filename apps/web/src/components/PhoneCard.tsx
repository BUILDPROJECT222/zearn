import { useEffect, useState } from 'react';
import { short, usd, type Accrual, type Sweep, type VaultState } from '../api';
import { fmtPrice } from '../systems';

export default function PhoneCard({ s, sweeps, accruals }: { s: VaultState | null; sweeps: Sweep[]; accruals: Accrual[] }) {
  const [tab, setTab] = useState<'token' | 'floor' | 'hold'>('token');
  const [now, setNow] = useState(new Date());
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  const holders = accruals[0]?.holders_count ?? 0;
  const backed = s && s.market && s.market.marketCapUsd > 0 ? (s.floorMcUsd / s.market.marketCapUsd) * 100 : null;
  const ok = sweeps.filter((w) => w.status === 'success').sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
  let cum = 0;
  const series = ok.map((w) => (cum += Number(w.floor_raw ?? 0) / 1e8));
  const pts = series.length > 1 ? series.map((v, i) => `${(i / (series.length - 1)) * 100},${40 - (v / (series[series.length - 1] || 1)) * 34}`).join(' ') : '';

  const copy = () => {
    if (!s?.mint) return;
    navigator.clipboard?.writeText(s.mint).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  };

  return (
    <div className="phone">
      <div className="status">
        <span>{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        <span>▮▮▮ ◔</span>
      </div>
      <div className="live">● {s?.dryRun ? 'DRY RUN' : 'LIVE'} · PUMP.FUN</div>
      <div className="name">
        <i>Z</i>
        <div><b>Zearn</b><small>$ZEARN / SOL · pump.fun</small></div>
      </div>
      <div className="price">
        {s?.market ? fmtPrice(s.market.priceUsd) : '–'}
        {backed !== null && <small>{backed.toFixed(1)}% backed</small>}
      </div>
      {tab === 'token' && (
        <div className="tiles">
          <div><small>Market cap</small><b>{usd(s?.market?.marketCapUsd ?? null)}</b></div>
          <div><small>Holders</small><b>{holders || '–'}</b></div>
          <div><small>Volume 24h</small><b>{usd(s?.market?.volume24h ?? null)}</b></div>
          <div><small>Floor MC</small><b className="gold">{usd(s?.floorMcUsd ?? null)}</b></div>
        </div>
      )}
      {tab === 'floor' && (
        <div className="tiles">
          <div><small>Vault</small><b className="gold">{s ? `${s.floorZec.toFixed(4)} ZEC` : '–'}</b></div>
          <div><small>Per token</small><b>{s ? s.floorPerTokenZec.toExponential(2) : '–'}</b></div>
          <div><small>Effective</small><b>{usd(s?.effectiveFloorMcUsd ?? null)}</b></div>
          <div><small>Arb gap</small><b className={s?.arbGapPct != null && s.arbGapPct > 0 ? 'green' : ''}>{s?.arbGapPct == null ? '–' : `${s.arbGapPct.toFixed(1)}%`}</b></div>
        </div>
      )}
      {tab === 'hold' && (
        <div className="tiles">
          <div><small>Pool</small><b className="green">{s ? `${(s.holdPendingZec + s.holdOwedZec).toFixed(4)} ZEC` : '–'}</b></div>
          <div><small>Accrued</small><b>{s ? s.holdOwedZec.toFixed(4) : '–'}</b></div>
          <div><small>Pending</small><b>{s ? s.holdPendingZec.toFixed(4) : '–'}</b></div>
          <div><small>Full unlock</small><b>8h</b></div>
        </div>
      )}
      <div className="spark">
        <svg viewBox="0 0 100 40" preserveAspectRatio="none">
          {pts ? <polyline points={pts} fill="none" stroke="#f4b728" strokeWidth="1.5" vectorEffect="non-scaling-stroke" /> : <text x="50" y="24" textAnchor="middle" fontSize="6" fill="#6b6b7c">floor history appears after 2 sweeps</text>}
        </svg>
      </div>
      <div className="mono muted" style={{ fontSize: 11 }}>{s?.market?.dex === 'pumpfun' ? 'Bonding curve · trading on pump.fun' : s?.market ? `Graduated · trading on ${s.market.dex}` : 'Not indexed yet'}</div>
      <div className="ca">
        <span className="tiny gold">CA</span>
        <span>{s?.mint ? short(s.mint, 6) : 'not set'}</span>
        <button onClick={copy}>{copied ? 'copied' : 'copy'}</button>
      </div>
      <div className="tabs">
        <button className={tab === 'token' ? 'on' : ''} onClick={() => setTab('token')}>Token</button>
        <button className={tab === 'floor' ? 'on' : ''} onClick={() => setTab('floor')}>Floor</button>
        <button className={tab === 'hold' ? 'on' : ''} onClick={() => setTab('hold')}>Hold</button>
      </div>
    </div>
  );
}
