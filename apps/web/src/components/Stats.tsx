import { ago, usd, type Sweep, type VaultState } from '../api';

function Spark({ values, color = '#f4b728' }: { values: number[]; color?: string }) {
  if (values.length < 2) return null;
  const W = 120;
  const H = 36;
  const max = Math.max(...values) || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * W},${H - (v / max) * (H - 4) - 2}`).join(' ');
  return (
    <svg className="spark" viewBox={`0 0 ${W} ${H}`}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

export default function Stats({ s, sweeps }: { s: VaultState | null; sweeps: Sweep[] }) {
  const ok = sweeps.filter((w) => w.status === 'success').sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
  let cum = 0;
  const cumFloor = ok.map((w) => (cum += Number(w.floor_raw ?? 0) / 1e8));
  const pct = s && s.market && s.market.marketCapUsd > 0 ? Math.min(100, (s.floorMcUsd / s.market.marketCapUsd) * 100) : 0;
  const totalHold = s ? s.holdPendingZec + s.holdOwedZec : 0;
  return (
    <div className="bento">
      <div className="big stat">
        <div className="l">Floor Vault · redeemable ZEC</div>
        <div className="v big-v">{s ? s.floorZec.toFixed(4) : '–'}</div>
        <div className="s">{s ? `${usd(s.floorMcUsd)} at ZEC ${usd(s.prices.zec)} · intents balance ${s.intentsBalanceZec === null ? 'n/a' : s.intentsBalanceZec.toFixed(4)}` : ''}</div>
        <div className="s" style={{ marginTop: 16 }}>Backing ratio: floor is <b className="gold">{pct.toFixed(1)}%</b> of market cap</div>
        <div className="progress"><div style={{ width: `${pct}%` }} /></div>
        <Spark values={cumFloor} />
      </div>
      <div className="mid stat">
        <div className="l">Hold Pool</div>
        <div className="v">{totalHold.toFixed(4)} ZEC</div>
        <div className="s">{s ? `${s.holdOwedZec.toFixed(4)} accrued to lots · ${s.holdPendingZec.toFixed(4)} waiting for the next epoch` : ''}</div>
      </div>
      <div className="sm stat">
        <div className="l">Floor per token</div>
        <div className="v" style={{ fontSize: 20 }}>{s ? `${s.floorPerTokenZec.toExponential(3)}` : '–'}</div>
        <div className="s">ZEC · {s && s.floorPerTokenUsd > 0 ? `$${s.floorPerTokenUsd.toPrecision(3)}` : '–'}</div>
      </div>
      <div className="sm stat">
        <div className="l">Effective floor MC</div>
        <div className="v" style={{ fontSize: 20 }}>{usd(s?.effectiveFloorMcUsd ?? null)}</div>
        <div className="s">after {s ? s.params.redeemFeeBps / 100 : 2}% redeem fee</div>
      </div>
      <div className="sm stat">
        <div className="l">Arbitrage gap</div>
        <div className={`v ${s?.arbGapPct != null && s.arbGapPct > 0 ? 'ok' : ''}`} style={{ fontSize: 20 }}>
          {s?.arbGapPct == null ? '–' : `${s.arbGapPct > 0 ? '+' : ''}${s.arbGapPct.toFixed(1)}%`}
        </div>
        <div className="s">{s && s.floorZec <= 0 ? 'vault empty, no floor yet' : s?.arbGapPct != null && s.arbGapPct > 0 ? 'buy → burn → profit' : 'price above floor'}</div>
      </div>
      <div className="mid stat">
        <div className="l">Keeper</div>
        <div className="v" style={{ fontSize: 20 }}>sweep {s ? ago(s.lastSweepAt) : '–'}</div>
        <div className="s">accrual epoch {s ? ago(s.lastAccrualAt) : '–'} · every {Math.round((s?.params.sweepIntervalSec ?? 300) / 60)} min · {ok.length} successful sweeps</div>
      </div>
    </div>
  );
}
