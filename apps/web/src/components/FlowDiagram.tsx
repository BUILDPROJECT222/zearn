import type { VaultState } from '../api';

type Node = { id: string; x: number; y: number; w?: number; h?: number; title: string; sub?: string; color?: string };
type Edge = { from: string; to: string; label?: string; dashed?: boolean; color?: string };

const W = 1040;
const H = 640;
const NW = 124;
const NH = 58;
const GOLD = '#f4b728';
const GREEN = '#3ee38a';
const BLUE = '#6ea8fe';
const PURPLE = '#c98bff';
const INK2 = '#a4a4b4';
const LINE = '#34343f';

/** End-to-end flow of Zearn as a swimlane diagram: fees, redeem, hold rewards, arbitrage. */
export default function FlowDiagram({ s }: { s: VaultState | null }) {
  const fee = s ? s.params.redeemFeeBps / 100 : 2;
  const split = s ? s.params.floorSplitBps / 100 : 50;
  const mins = Math.round((s?.params.sweepIntervalSec ?? 300) / 60);

  const lanes = [
    { y: 30, h: 170, title: `1 · FEES → ZEC · every ${mins} min`, color: GOLD },
    { y: 220, h: 170, title: '2 · REDEEM · any time', color: BLUE },
    { y: 410, h: 200, title: '3 · HOLD REWARDS · every epoch', color: GREEN },
  ];
  const nodes: Node[] = [
    // lane 1
    { id: 'trader', x: 30, y: 85, title: 'Trader', sub: 'buys / sells $ZEARN' },
    { id: 'pump', x: 170, y: 85, title: 'pump.fun', sub: 'creator fee 0.30–0.95%' },
    { id: 'vaultw', x: 310, y: 85, title: 'Vault wallet', sub: 'SOL lands here' },
    { id: 'keeper', x: 450, y: 85, title: 'Keeper', sub: 'sweeps above 0.1 SOL', color: GOLD },
    { id: 'oneclick1', x: 590, y: 85, title: '1Click swap', sub: 'NEAR Intents · SOL → ZEC ~20 s', color: BLUE },
    { id: 'treasury', x: 730, y: 85, title: 'intents.near', sub: 'ZEC treasury, public' },
    { id: 'floor', x: 890, y: 50, w: 120, h: 46, title: `Floor Vault ${split}%`, sub: 'backs every token', color: GOLD },
    { id: 'hold', x: 890, y: 124, w: 120, h: 46, title: `Hold Pool ${100 - split}%`, sub: 'accrues to holders', color: GREEN },
    // lane 2
    { id: 'holder', x: 30, y: 275, title: 'Holder', sub: 'picks amount + payout' },
    { id: 'burn', x: 170, y: 275, title: 'Burn + memo', sub: 'ZEARN:<kind>:<addr>' },
    { id: 'detect', x: 310, y: 275, title: 'Detected', sub: 'website or burn scanner' },
    { id: 'compute', x: 450, y: 275, title: 'Pro-rata payout', sub: `burned ÷ supply × vault − ${fee}%`, color: GOLD },
    { id: 'oneclick2', x: 590, y: 275, title: '1Click order', sub: 'from intents balance', color: BLUE },
    { id: 'dest', x: 730, y: 275, w: 150, title: 'Destination', sub: 'SOL · ZEC · USDC · NEAR' },
    // lane 3
    { id: 'snap', x: 30, y: 465, title: 'Snapshot', sub: 'all holder wallets' },
    { id: 'lots', x: 170, y: 465, title: 'Lots', sub: 'buy opens · sell cuts LIFO' },
    { id: 'accrue', x: 310, y: 465, title: 'Accrue', sub: 'pool ÷ pro-rata to lots', color: GREEN },
    { id: 'unlock', x: 450, y: 465, title: 'Unlock by age', sub: '15 min 5% → 8 h 100%' },
    { id: 'claim', x: 590, y: 465, title: 'Claim', sub: 'signed message, no tx' },
    { id: 'oneclick3', x: 730, y: 465, title: '1Click payout', sub: 'same routes as redeem', color: BLUE },
    // arb
    { id: 'arb', x: 890, y: 275, w: 120, h: 96, title: 'Arb loop', sub: 'price < floor → bots buy + burn → price returns', color: PURPLE },
  ];
  const edges: Edge[] = [
    { from: 'trader', to: 'pump' },
    { from: 'pump', to: 'vaultw' },
    { from: 'vaultw', to: 'keeper' },
    { from: 'keeper', to: 'oneclick1' },
    { from: 'oneclick1', to: 'treasury' },
    { from: 'treasury', to: 'floor' },
    { from: 'treasury', to: 'hold' },
    { from: 'holder', to: 'burn' },
    { from: 'burn', to: 'detect' },
    { from: 'detect', to: 'compute' },
    { from: 'compute', to: 'oneclick2' },
    { from: 'oneclick2', to: 'dest' },
    { from: 'snap', to: 'lots' },
    { from: 'lots', to: 'accrue' },
    { from: 'accrue', to: 'unlock' },
    { from: 'unlock', to: 'claim' },
    { from: 'claim', to: 'oneclick3' },
  ];
  const byId = Object.fromEntries(nodes.map((n) => [n.id, { ...n, w: n.w ?? NW, h: n.h ?? NH }]));
  const right = (n: Node) => ({ x: n.x + (n.w ?? NW), y: n.y + (n.h ?? NH) / 2 });
  const left = (n: Node) => ({ x: n.x, y: n.y + (n.h ?? NH) / 2 });
  const bottom = (n: Node) => ({ x: n.x + (n.w ?? NW) / 2, y: n.y + (n.h ?? NH) });
  const top = (n: Node) => ({ x: n.x + (n.w ?? NW) / 2, y: n.y });

  return (
    <div className="chart">
      <h3>The whole machine on one page</h3>
      <div className="sub">Three loops run side by side. Gold is where value is decided, blue is NEAR Intents, green is the hold pool.</div>
      <div style={{ overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Zearn end-to-end flow" style={{ minWidth: 860 }}>
        <defs>
          <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" fill={INK2} />
          </marker>
          <marker id="arrg" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" fill={GOLD} />
          </marker>
          <marker id="arrgr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" fill={GREEN} />
          </marker>
        </defs>

        {lanes.map((l) => (
          <g key={l.title}>
            <rect x="14" y={l.y} width={W - 28} height={l.h} rx="14" fill="rgba(255,255,255,0.025)" stroke={LINE} />
            <text x="30" y={l.y + 22} fontFamily="JetBrains Mono, monospace" fontSize="11" fill={l.color} letterSpacing="0.12em">{l.title}</text>
          </g>
        ))}

        {/* straight edges */}
        {edges.map((e, i) => {
          const a = byId[e.from];
          const b = byId[e.to];
          const p = right(a);
          const q = left(b);
          const mid = (p.x + q.x) / 2;
          return <path key={i} d={`M${p.x},${p.y} C${mid},${p.y} ${mid},${q.y} ${q.x},${q.y}`} fill="none" stroke={INK2} strokeWidth="1.6" markerEnd="url(#arr)" />;
        })}

        {/* cross-lane links */}
        {(() => {
          const f = byId.floor;
          const c = byId.compute;
          const h = byId.hold;
          const ac = byId.accrue;
          const lo = byId.lots;
          const ar = byId.arb;
          const fb = bottom(f);
          const ct = top(c);
          const hb = bottom(h);
          const at = top(ac);
          const lt = top(lo);
          return (
            <g>
              {/* floor -> compute: pays redeems */}
              <path d={`M${fb.x},${fb.y} C${fb.x},${fb.y + 40} ${ct.x + 40},${ct.y - 60} ${ct.x + 20},${ct.y}`} fill="none" stroke={GOLD} strokeWidth="1.6" strokeDasharray="6 4" markerEnd="url(#arrg)" />
              <text x={ct.x + 130} y={ct.y - 26} fontFamily="Inter, sans-serif" fontSize="10.5" fill={GOLD}>pays every redeem in-kind · fee stays</text>
              {/* hold pool -> accrue */}
              <path d={`M${hb.x},${hb.y} C${hb.x},${hb.y + 60} ${at.x + 60},${at.y - 90} ${at.x + 20},${at.y}`} fill="none" stroke={GREEN} strokeWidth="1.6" strokeDasharray="6 4" markerEnd="url(#arrgr)" />
              <text x={at.x + 150} y={at.y - 22} fontFamily="Inter, sans-serif" fontSize="10.5" fill={GREEN}>each epoch, to lots that existed before it</text>
              {/* lots -> hold pool: forfeits */}
              <path d={`M${lt.x - 20},${lt.y} C${lt.x - 20},${lt.y - 40} ${hb.x - 240},${hb.y + 120} ${hb.x - 40},${hb.y + 4}`} fill="none" stroke={GREEN} strokeWidth="1.2" strokeDasharray="2 4" markerEnd="url(#arrgr)" />
              <text x={lt.x + 4} y={lt.y - 8} fontFamily="Inter, sans-serif" fontSize="10.5" fill={GREEN}>early sell forfeits the locked part back</text>
              {/* arb -> floor */}
              <path d={`M${ar.x + ar.w},${ar.y + 20} C${W - 6},${ar.y + 20} ${W - 6},${f.y + f.h / 2} ${f.x + f.w + 2},${f.y + f.h / 2}`} fill="none" stroke={PURPLE} strokeWidth="1.4" strokeDasharray="4 4" markerEnd="url(#arr)" />
            </g>
          );
        })()}

        {/* nodes */}
        {nodes.map((n) => {
          const w = n.w ?? NW;
          const h = n.h ?? NH;
          const c = n.color ?? LINE;
          return (
            <g key={n.id}>
              <rect x={n.x} y={n.y} width={w} height={h} rx="10" fill="#111117" stroke={c} strokeWidth={n.color ? 1.6 : 1} />
              <text x={n.x + 10} y={n.y + 22} fontFamily="Space Grotesk, Inter, sans-serif" fontSize="12.5" fontWeight="700" fill="#f2efe6">{n.title}</text>
              {n.sub && (
                <foreignObject x={n.x + 8} y={n.y + 27} width={w - 16} height={h - 30}>
                  <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, lineHeight: '12px', color: INK2 }}>{n.sub}</div>
                </foreignObject>
              )}
            </g>
          );
        })}

        <text x="30" y={H - 8} fontFamily="JetBrains Mono, monospace" fontSize="10" fill="#6b6b7c">no contract deployed by Zearn · custody: keeper wallet + NEAR account (v1) · every step shows up in the Ledger</text>
      </svg>
      </div>
    </div>
  );
}
