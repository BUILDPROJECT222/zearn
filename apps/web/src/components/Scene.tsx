import { ago, usd, type VaultState } from '../api';

/**
 * Animated flow scene: pump.fun trades -> keeper -> NEAR Intents -> ZEC vault -> floor / hold pool.
 * Coins ride SVG motion paths; callouts overlay live numbers.
 */
export default function Scene({ s }: { s: VaultState | null }) {
  const floor = s?.floorZec ?? 0;
  const hold = s ? s.holdPendingZec + s.holdOwedZec : 0;
  const total = Math.max(floor + hold, 0.0001);
  const fillF = 0.25 + 0.7 * (floor / total);
  const fillH = 0.25 + 0.7 * (hold / total);
  const arb = s?.arbGapPct ?? null;
  const coins = (path: string, color: string, n: number, dur: number, label: string) =>
    Array.from({ length: n }).map((_, i) => (
      <g key={`${path}${i}`}>
        <circle r="7" fill={color} stroke="#000" strokeWidth="1.5">
          <animateMotion dur={`${dur}s`} repeatCount="indefinite" begin={`${(i * dur) / n}s`}><mpath href={`#${path}`} /></animateMotion>
        </circle>
        <text fontSize="8" fontFamily="JetBrains Mono, monospace" textAnchor="middle" dy="3" fill="#000" fontWeight="700">
          {label}
          <animateMotion dur={`${dur}s`} repeatCount="indefinite" begin={`${(i * dur) / n}s`}><mpath href={`#${path}`} /></animateMotion>
        </text>
      </g>
    ));

  return (
    <div className="scene">
      <div className="grid" />
      <div className="bar">
        <span>■ <b>{s?.dryRun ? 'DEMO · DRY RUN' : 'LIVE'}</b> · {s ? `$ZEARN on ${s.market?.dex === 'pumpfun' ? 'pump.fun bonding curve' : s.market?.dex ?? 'pump.fun'}` : 'connecting'}</span>
        <span>· fees never sleep ·</span>
      </div>
      <svg viewBox="0 0 900 400" role="img" aria-label="Fee to ZEC flow">
        <defs>
          <linearGradient id="vg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2a2a36" /><stop offset="1" stopColor="#15151d" /></linearGradient>
          <linearGradient id="gf" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#f4b728" /><stop offset="1" stopColor="#ffd76a" /></linearGradient>
          <linearGradient id="gh" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#3ee38a" /><stop offset="1" stopColor="#9ff5c8" /></linearGradient>
          <filter id="glow"><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          <path id="p1" d="M150 250 C 200 250, 210 210, 270 210" />
          <path id="p2" d="M330 210 C 380 210, 390 190, 440 190" />
          <path id="p3" d="M520 190 C 560 190, 580 220, 640 220" />
          <path id="p4" d="M700 300 C 700 330, 660 340, 620 350" />
          <path id="p5" d="M740 300 C 740 330, 780 340, 820 350" />
        </defs>

        {/* floor line */}
        <line x1="20" y1="372" x2="880" y2="372" stroke="#24242e" strokeWidth="2" strokeDasharray="6 6" />

        {/* pipes */}
        {['p1', 'p2', 'p3', 'p4', 'p5'].map((p) => (
          <use key={p} href={`#${p}`} stroke="#34343f" strokeWidth="10" fill="none" strokeLinecap="round" />
        ))}
        {['p1', 'p2', 'p3', 'p4', 'p5'].map((p) => (
          <use key={`${p}i`} href={`#${p}`} stroke="#0d0d12" strokeWidth="6" fill="none" strokeLinecap="round" />
        ))}

        {/* pump.fun terminal */}
        <g transform="translate(40,190)">
          <rect width="110" height="120" rx="8" fill="url(#vg)" stroke="#34343f" />
          <rect x="10" y="12" width="90" height="60" rx="4" fill="#0a0a0e" stroke="#24242e" />
          {[0, 1, 2, 3, 4, 5, 6].map((i) => {
            const h = [18, 30, 22, 40, 28, 46, 36][i];
            return <rect key={i} x={16 + i * 12} y={68 - h} width="7" height={h} fill={i % 3 === 1 ? '#ff6b61' : '#3ee38a'} />;
          })}
          <text x="55" y="95" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="9" fill="#a4a4b4">PUMP.FUN</text>
          <text x="55" y="110" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="9" fill="#6b6b7c">creator fee</text>
        </g>

        {/* keeper bot */}
        <g transform="translate(270,160)">
          <rect x="0" y="20" width="60" height="70" rx="10" fill="url(#vg)" stroke="#f4b728" />
          <rect x="12" y="34" width="36" height="20" rx="4" fill="#0a0a0e" />
          <rect x="17" y="40" width="8" height="8" fill="#f4b728"><animate attributeName="opacity" values="1;1;0.1;1" dur="3s" repeatCount="indefinite" /></rect>
          <rect x="35" y="40" width="8" height="8" fill="#f4b728"><animate attributeName="opacity" values="1;1;0.1;1" dur="3s" repeatCount="indefinite" /></rect>
          <rect x="26" y="8" width="8" height="12" fill="#f4b728" />
          <circle cx="30" cy="6" r="4" fill="#f4b728" filter="url(#glow)"><animate attributeName="r" values="3;5;3" dur="1.6s" repeatCount="indefinite" /></circle>
          <text x="30" y="108" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="9" fill="#a4a4b4">KEEPER</text>
        </g>

        {/* NEAR Intents gateway */}
        <g transform="translate(440,130)">
          <path d="M0 80 V30 A40 40 0 0 1 80 30 V80" fill="none" stroke="#6ea8fe" strokeWidth="6" />
          <path d="M12 80 V34 A28 28 0 0 1 68 34 V80" fill="#0a0a0e" stroke="#34343f" />
          <rect x="24" y="52" width="32" height="6" fill="#6ea8fe"><animate attributeName="x" values="24;40;24" dur="2s" repeatCount="indefinite" /></rect>
          <text x="40" y="100" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="9" fill="#a4a4b4">NEAR INTENTS</text>
          <text x="40" y="114" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="9" fill="#6b6b7c">SOL → ZEC</text>
        </g>

        {/* vault */}
        <g transform="translate(640,150)">
          <rect width="160" height="150" rx="12" fill="url(#vg)" stroke="#f4b728" strokeWidth="2" />
          <rect x="14" y="14" width="132" height="122" rx="8" fill="#0a0a0e" stroke="#34343f" />
          <circle cx="80" cy="75" r="30" fill="none" stroke="#f4b728" strokeWidth="6" />
          <circle cx="80" cy="75" r="18" fill="none" stroke="#34343f" strokeWidth="3" />
          <g>
            <rect x="77" y="45" width="6" height="18" fill="#f4b728" />
            <animateTransform attributeName="transform" type="rotate" from="0 80 75" to="360 80 75" dur="14s" repeatCount="indefinite" />
          </g>
          <text x="80" y="128" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="10" fill="#f4b728">ZEC VAULT</text>
        </g>

        {/* tanks */}
        <g transform="translate(570,340)">
          <rect width="90" height="36" rx="6" fill="#0a0a0e" stroke="#34343f" />
          <rect x="2" y={2 + 32 * (1 - fillF)} width="86" height={32 * fillF} rx="4" fill="url(#gf)" opacity="0.9" />
          <text x="45" y="23" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="9" fill="#000">FLOOR {Math.round((s?.params.floorSplitBps ?? 5000) / 100)}%</text>
        </g>
        <g transform="translate(780,340)">
          <rect width="90" height="36" rx="6" fill="#0a0a0e" stroke="#34343f" />
          <rect x="2" y={2 + 32 * (1 - fillH)} width="86" height={32 * fillH} rx="4" fill="url(#gh)" opacity="0.9" />
          <text x="45" y="23" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="9" fill="#000">HOLD {100 - Math.round((s?.params.floorSplitBps ?? 5000) / 100)}%</text>
        </g>

        {/* coins */}
        {coins('p1', '#6ea8fe', 3, 4, 'S')}
        {coins('p2', '#6ea8fe', 2, 3, 'S')}
        {coins('p3', '#f4b728', 3, 4, 'Z')}
        {coins('p4', '#f4b728', 2, 5, 'Z')}
        {coins('p5', '#3ee38a', 2, 5, 'Z')}

        {/* arb hawk */}
        <g transform="translate(560,60)">
          <path d="M0 10 L14 0 L28 10 L14 6 Z" fill={arb !== null && arb > 0 ? '#ff6b61' : '#6b6b7c'}>
            <animateTransform attributeName="transform" type="translate" values="0 0; 40 -6; 80 0; 40 6; 0 0" dur="8s" repeatCount="indefinite" />
          </path>
        </g>
      </svg>
      <div className="scan" />

      <div className="callout" style={{ left: '4%', top: '22%' }}>
        <b>Trades → fees</b>
        <span>{s?.market ? `${usd(s.market.volume24h)} vol 24h` : 'waiting for market'}</span>
      </div>
      <div className="callout" style={{ left: '28%', top: '16%' }}>
        <b>Keeper</b>
        <span>sweep {s ? ago(s.lastSweepAt) : '–'} · every {Math.round((s?.params.sweepIntervalSec ?? 300) / 60)} min</span>
      </div>
      <div className="callout" style={{ left: '43%', top: '68%' }}>
        <b>Bridge</b>
        <span>ZEC {usd(s?.prices.zec ?? null)} · SOL {usd(s?.prices.sol ?? null, 2)}</span>
      </div>
      <div className="callout" style={{ right: '3%', top: '18%' }}>
        <b>Vault {s ? `${s.floorZec.toFixed(4)} ZEC` : '–'}</b>
        <span>floor {usd(s?.floorMcUsd ?? null)} · hold {hold.toFixed(4)} ZEC</span>
      </div>
      <div className="callout" style={{ left: '60%', top: '4%' }}>
        <b>Arb watcher</b>
        <span className={arb !== null && arb > 0 ? 'green' : ''}>{arb === null ? 'no market data' : arb > 0 ? `OPEN +${arb.toFixed(1)}%` : `closed · gap ${arb.toFixed(1)}%`}</span>
      </div>
      <div className="caption">zearn · solana · near intents 1click · zcash · all numbers live</div>
    </div>
  );
}
