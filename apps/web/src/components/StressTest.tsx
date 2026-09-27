import { useState } from 'react';
import { usd, type VaultState } from '../api';

export default function StressTest({ s }: { s: VaultState | null }) {
  const [pct, setPct] = useState(60); // market cap as % of current market cap
  const [tokens, setTokens] = useState(1_000_000);
  const baseMc = s?.market?.marketCapUsd ?? 0;
  const mc = (baseMc * pct) / 100;
  const floor = s?.floorMcUsd ?? 0;
  const eff = s?.effectiveFloorMcUsd ?? 0;
  const supply = s?.supply ?? 1;
  const gap = mc > 0 ? (eff / mc - 1) * 100 : 0;
  const marketValue = (tokens / supply) * mc;
  const redeemValue = (tokens / supply) * eff;
  const open = gap > 0;
  return (
    <div className="stress">
      <div>
        <label>Simulated market cap: <b className="gold">{usd(mc)}</b> ({pct}% of current)</label>
        <input type="range" min="1" max="300" value={pct} onChange={(e) => setPct(Number(e.target.value))} />
        <label>Your position (ZEARN)</label>
        <input type="number" value={tokens} onChange={(e) => setTokens(Math.max(0, Number(e.target.value)))} />
        <div className="verdict">
          {!s?.market ? 'Waiting for market data…' : open ? <span className="ok">Arbitrage opens at this price.</span> : <span>Price sits above the floor. Nothing happens.</span>}
        </div>
        <p className="note">
          {open
            ? `Bots buy at ${usd(mc)} market cap and burn for ${usd(eff)} worth of ZEC, a ${gap.toFixed(0)}% spread. Their buying pushes the price back toward the floor. You can exit into ZEC at any time.`
            : `The floor is ${usd(floor)}; the price would have to fall ${baseMc > 0 ? (100 - (eff / baseMc) * 100).toFixed(0) : '–'}% from today before arbitrage kicks in. Until then the floor is a safety net, not a price driver.`}
        </p>
      </div>
      <div className="readout">
        <div><small>Position at market</small><b>{usd(marketValue, 2)}</b></div>
        <div><small>Position via redeem</small><b className={redeemValue > marketValue ? 'ok' : ''}>{usd(redeemValue, 2)}</b></div>
        <div><small>Effective floor MC</small><b>{usd(eff)}</b></div>
        <div><small>Arb spread</small><b className={open ? 'ok' : ''}>{s?.market ? `${gap > 0 ? '+' : ''}${gap.toFixed(1)}%` : '–'}</b></div>
      </div>
    </div>
  );
}
