import type { Sweep, VaultState } from '../api';

function FloorChart({ sweeps, zecUsd }: { sweeps: Sweep[]; zecUsd: number }) {
  const ok = sweeps.filter((w) => w.status === 'success').sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
  const W = 640;
  const H = 240;
  const P = { l: 44, r: 16, t: 16, b: 28 };
  let cum = 0;
  const pts = ok.map((w) => ({ t: Date.parse(w.created_at), v: (cum += Number(w.floor_raw ?? 0) / 1e8) }));
  if (pts.length < 2) {
    return (
      <div className="chart">
        <h3>Floor growth</h3>
        <div className="sub">Cumulative ZEC in the Floor Vault per sweep</div>
        <div className="note">Not enough sweeps yet. The curve appears after the second successful sweep.</div>
      </div>
    );
  }
  const t0 = pts[0].t;
  const t1 = pts[pts.length - 1].t;
  const max = pts[pts.length - 1].v * 1.1;
  const x = (t: number) => P.l + ((t - t0) / Math.max(1, t1 - t0)) * (W - P.l - P.r);
  const y = (v: number) => H - P.b - (v / max) * (H - P.t - P.b);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.t)},${y(p.v)}`).join(' ');
  const area = `${line} L${x(t1)},${H - P.b} L${x(t0)},${H - P.b} Z`;
  const ticks = [0.25, 0.5, 0.75, 1].map((f) => max * f);
  return (
    <div className="chart">
      <h3>Floor growth</h3>
      <div className="sub">Cumulative ZEC in the Floor Vault · {ok.length} sweeps · now {pts[pts.length - 1].v.toFixed(4)} ZEC ≈ ${(pts[pts.length - 1].v * zecUsd).toFixed(0)}</div>
      <svg viewBox={`0 0 ${W} ${H}`}>
        <defs>
          <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f4b728" stopOpacity="0.45" />
            <stop offset="1" stopColor="#f4b728" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={P.l} x2={W - P.r} y1={y(v)} y2={y(v)} stroke="#262630" />
            <text x={P.l - 6} y={y(v) + 4} textAnchor="end" fill="#6c6c7c" fontSize="10" fontFamily="JetBrains Mono, monospace">{v.toFixed(3)}</text>
          </g>
        ))}
        <path d={area} fill="url(#area)" />
        <path d={line} fill="none" stroke="#f4b728" strokeWidth="2.5" strokeLinejoin="round" />
        {pts.map((p, i) => (
          <circle key={i} cx={x(p.t)} cy={y(p.v)} r="3" fill="#0a0a0d" stroke="#ffd76a" strokeWidth="2" />
        ))}
        <text x={P.l} y={H - 8} fill="#6c6c7c" fontSize="10" fontFamily="JetBrains Mono, monospace">{new Date(t0).toLocaleTimeString()}</text>
        <text x={W - P.r} y={H - 8} textAnchor="end" fill="#6c6c7c" fontSize="10" fontFamily="JetBrains Mono, monospace">{new Date(t1).toLocaleTimeString()}</text>
      </svg>
    </div>
  );
}

export function UnlockCurve({ curve, compact = false }: { curve: [number, number][]; compact?: boolean }) {
  const W = 420;
  const H = 240;
  const P = { l: 40, r: 16, t: 16, b: 28 };
  const maxH = curve[curve.length - 1][0];
  const x = (h: number) => P.l + (h / maxH) * (W - P.l - P.r);
  const y = (v: number) => H - P.b - v * (H - P.t - P.b);
  const line = curve.map(([h, v], i) => `${i ? 'L' : 'M'}${x(h)},${y(v)}`).join(' ');
  return (
    <div className="chart">
      <h3>Hold-to-unlock curve</h3>
      <div className="sub">Share of accrued ZEC you can claim, by lot age</div>
      <svg viewBox={`0 0 ${W} ${H}`}>
        {[0.25, 0.5, 0.75, 1].map((v) => (
          <g key={v}>
            <line x1={P.l} x2={W - P.r} y1={y(v)} y2={y(v)} stroke="#262630" />
            <text x={P.l - 6} y={y(v) + 4} textAnchor="end" fill="#6c6c7c" fontSize="10" fontFamily="JetBrains Mono, monospace">{v * 100}%</text>
          </g>
        ))}
        <path d={line} fill="none" stroke="#6ea8fe" strokeWidth="2.5" strokeLinejoin="round" />
        {curve.map(([h, v]) => (
          <g key={h}>
            <circle cx={x(h)} cy={y(v)} r="3.5" fill="#0a0a0d" stroke="#6ea8fe" strokeWidth="2" />
            {h > 0 && (
              <text x={x(h)} y={y(v) - 9} textAnchor="middle" fill="#a3a3b3" fontSize="10" fontFamily="JetBrains Mono, monospace">
                {h < 1 ? `${Math.round(h * 60)}m` : `${h}h`}
              </text>
            )}
          </g>
        ))}
        <text x={W - P.r} y={H - 8} textAnchor="end" fill="#6c6c7c" fontSize="10" fontFamily="JetBrains Mono, monospace">hold time →</text>
      </svg>
      {!compact && <div className="note">Flipping in 15 minutes unlocks 5% of a 15-minute accrual, which never covers the round-trip fee. Farming is unprofitable by design.</div>}
    </div>
  );
}

export default function Charts({ s, sweeps }: { s: VaultState | null; sweeps: Sweep[] }) {
  return (
    <div className="charts">
      <FloorChart sweeps={sweeps} zecUsd={s?.prices.zec ?? 0} />
      <UnlockCurve curve={s?.params.vestCurve ?? [[0, 0], [0.25, 0.05], [0.5, 0.1], [1, 0.2], [2, 0.35], [4, 0.6], [6, 0.8], [8, 1]]} />
    </div>
  );
}
