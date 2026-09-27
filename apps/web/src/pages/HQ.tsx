import type { Data } from '../App';
import { ago, usd } from '../api';
import Scene from '../components/Scene';
import PhoneCard from '../components/PhoneCard';
import Verify from '../components/Verify';
import ActivityLog from '../components/ActivityLog';

export default function HQ({ d }: { d: Data }) {
  const { s } = d;
  const holders = d.accruals[0]?.holders_count ?? 0;
  const ok = d.sweeps.filter((w) => w.status === 'success').length;
  return (
    <>
      <div className="hq">
        <div>
          <Scene s={s} />
          <div style={{ padding: '22px 4px 4px' }}>
            <div className="eyebrow">zearn · solana · near intents · zcash</div>
            <h1 className="title">
              Hold to zearn. <em>The floor holds.</em>
            </h1>
            <p className="lead">
              $ZEARN is a pump.fun coin whose creator fees become ZEC in a public treasury on NEAR Intents. Every trade fills the vault, the vault holds the floor. Burn to redeem your share any time. Hold to unlock the rest. No trading desk, no APY promises.
            </p>
            <div className="cta">
              <a className="btn gold" href={s?.mint ? `https://pump.fun/coin/${s.mint}` : '#'} target="_blank" rel="noreferrer">Buy on pump.fun →</a>
              <button className="btn" onClick={() => d.go('redeem')}>Redeem ZEC</button>
              <button className="btn" onClick={() => d.go('how')}>How it works</button>
            </div>
          </div>
        </div>
        <PhoneCard s={s} sweeps={d.sweeps} accruals={d.accruals} />
      </div>

      <div className="gap-lg" />
      <div className="strip">
        <div><small>Price</small><b>{s?.market ? `$${s.market.priceUsd.toPrecision(3)}` : '–'}</b><span>$ZEARN</span></div>
        <div><small>Market cap</small><b>{usd(s?.market?.marketCapUsd ?? null)}</b><span>{usd(s?.market?.volume24h ?? null)} vol 24h</span></div>
        <div><small>Floor vault</small><b className="gold">{s ? `${s.floorZec.toFixed(3)} ZEC` : '–'}</b><span>{usd(s?.floorMcUsd ?? null)} floor MC</span></div>
        <div><small>Backed</small><b>{s && s.market && s.market.marketCapUsd > 0 ? `${((s.floorMcUsd / s.market.marketCapUsd) * 100).toFixed(1)}%` : '–'}</b><span>of market cap</span></div>
        <div><small>Holders</small><b>{holders || '–'}</b><span>eligible for hold pool</span></div>
        <div><small>Sweeps</small><b className="green">{ok}</b><span>last {s ? ago(s.lastSweepAt) : '–'}</span></div>
      </div>

      <div className="gap-lg" />
      <Verify s={s} />
      <div className="gap-lg" />
      <ActivityLog d={d} />
    </>
  );
}
