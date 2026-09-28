// Requires: npm i @resvg/resvg-js@2 (run from a folder where it is installed). Windows fonts: Segoe UI, Consolas.
// Content cards 11-20 for X, 1600x900 PNG. Same look as make-cards.mjs. node make-cards-2.mjs [indexes...]
import { Resvg } from '@resvg/resvg-js';
import { mkdirSync, writeFileSync } from 'node:fs';

const OUT = 'E:/project/near/brand/content';
mkdirSync(OUT, { recursive: true });
const W = 1600, H = 900;
const FONT = {
  fontFiles: ['C:/Windows/Fonts/seguibl.ttf', 'C:/Windows/Fonts/segoeuib.ttf', 'C:/Windows/Fonts/segoeui.ttf', 'C:/Windows/Fonts/consola.ttf', 'C:/Windows/Fonts/consolab.ttf'],
  loadSystemFonts: false,
  defaultFontFamily: 'Segoe UI',
};
const C = { bg: '#08080b', panel: '#111117', line: '#34343f', ink: '#f2efe6', ink2: '#a4a4b4', ink3: '#6b6b7c', gold: '#f4b728', gold2: '#ffe08a', green: '#3ee38a', blue: '#6ea8fe', red: '#ff6b61', purple: '#c98bff', zec: '#f4b728' };
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const ZPATH = 'M128 106 H272 V136 L172 244 H272 V274 H128 V244 L228 136 H128 Z';

// ---------- primitives ----------
const T = (x, y, size, parts, opt = {}) => {
  const spans = (Array.isArray(parts) ? parts : [[parts, opt.color ?? C.ink]]).map(([t, c]) => `<tspan fill="${c}">${esc(t)}</tspan>`).join('');
  return `<text x="${x}" y="${y}" font-family="${opt.mono ? 'Consolas' : 'Segoe UI'}" font-weight="${opt.weight ?? 900}" font-size="${size}" letter-spacing="${opt.ls ?? (opt.mono ? 2 : size > 48 ? -1.5 : 0)}" text-anchor="${opt.anchor ?? 'start'}"${opt.glow ? ' filter="url(#softglow)"' : ''}>${spans}</text>`;
};
const box = (x, y, w, h, stroke = C.line, fill = C.panel, sw = 2, rx = 18) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
const coin = (x, y, r, color, label) => `<g><circle cx="${x}" cy="${y}" r="${r}" fill="${color}" stroke="#000" stroke-opacity="0.5" stroke-width="2"/><circle cx="${x - r * 0.3}" cy="${y - r * 0.3}" r="${r * 0.28}" fill="#fff" opacity="0.35"/><text x="${x}" y="${y + r * 0.36}" font-family="Segoe UI" font-weight="900" font-size="${r * 1.05}" text-anchor="middle" fill="#0a0a0e">${label}</text></g>`;
const arrow = (x1, y1, x2, y2, color = C.gold) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="4" marker-end="url(#arr-${color.slice(1)})"/>`;
const shield = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})"><path d="M13 0 L25 5 V13 C25 21 19.5 26 13 28 C6.5 26 1 21 1 13 V5 Z" fill="${C.gold}" fill-opacity="0.2" stroke="${C.gold}" stroke-width="2.4" stroke-linejoin="round"/><path d="M8 14 L12 18 L19 10" fill="none" stroke="${C.gold2}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></g>`;
const logo = (cx, cy, s) => `<g transform="translate(${cx} ${cy}) scale(${s}) translate(-200 -200)"><circle cx="200" cy="200" r="168" fill="#0d0c0e" stroke="url(#ring)" stroke-width="9"/><path d="${ZPATH}" fill="url(#gold)"/><rect x="104" y="294" width="192" height="12" rx="6" fill="#ffe9a8" filter="url(#glow)"/></g>`;
// neutral marks (not the official logos): a Z-in-circle for Zcash, an N-in-rounded-square for NEAR
const zecMark = (cx, cy, r) => `<g><circle cx="${cx}" cy="${cy}" r="${r}" fill="#15130c" stroke="${C.gold}" stroke-width="${r * 0.08}"/><text x="${cx}" y="${cy + r * 0.22}" font-family="Segoe UI" font-weight="900" font-size="${r * 0.62}" text-anchor="middle" fill="${C.gold}">ZEC</text></g>`;
const nearMark = (cx, cy, r) => `<g><rect x="${cx - r}" y="${cy - r}" width="${2 * r}" height="${2 * r}" rx="${r * 0.35}" fill="#0f1420" stroke="${C.blue}" stroke-width="${r * 0.08}"/><text x="${cx}" y="${cy + r * 0.19}" font-family="Segoe UI" font-weight="900" font-size="${r * 0.52}" text-anchor="middle" fill="${C.blue}">NEAR</text></g>`;

const arrowDefs = [C.gold, C.green, C.blue, C.red, C.purple, C.ink2].map((c) => `<marker id="arr-${c.slice(1)}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 L10 5 L0 10 z" fill="${c}"/></marker>`).join('');
const DEFS = `<defs>
  <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse"><path d="M50 0 H0 V50" fill="none" stroke="#fff" stroke-opacity="0.045"/></pattern>
  <radialGradient id="g1" cx="85%" cy="0%" r="70%"><stop offset="0" stop-color="${C.gold}" stop-opacity="0.18"/><stop offset="1" stop-color="${C.gold}" stop-opacity="0"/></radialGradient>
  <radialGradient id="g2" cx="0%" cy="100%" r="60%"><stop offset="0" stop-color="${C.blue}" stop-opacity="0.10"/><stop offset="1" stop-color="${C.blue}" stop-opacity="0"/></radialGradient>
  <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe08a"/><stop offset="0.5" stop-color="#f4b728"/><stop offset="1" stop-color="#c98a10"/></linearGradient>
  <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffd76a"/><stop offset="0.5" stop-color="#b8860b"/><stop offset="1" stop-color="#ffd76a"/></linearGradient>
  <linearGradient id="redfade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.red}" stop-opacity="0.35"/><stop offset="1" stop-color="${C.red}" stop-opacity="0"/></linearGradient>
  <linearGradient id="greenfade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.green}" stop-opacity="0.30"/><stop offset="1" stop-color="${C.green}" stop-opacity="0"/></linearGradient>
  <filter id="glow" x="-50%" y="-300%" width="200%" height="700%"><feGaussianBlur stdDeviation="8" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <filter id="softglow" x="-10%" y="-40%" width="120%" height="180%"><feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  ${arrowDefs}
</defs>`;

/** shared frame: background, header chip with index, left text column (eyebrow, title lines, body lines), footer */
function card(i, { eyebrow, title, body = [], art, eyebrowColor = C.gold }) {
  let s = `<rect width="${W}" height="${H}" fill="${C.bg}"/><rect width="${W}" height="${H}" fill="url(#grid)"/><rect width="${W}" height="${H}" fill="url(#g1)"/><rect width="${W}" height="${H}" fill="url(#g2)"/>`;
  s += logo(98, 96, 0.19) + T(140, 106, 30, [['ZEARN', C.ink]], { weight: 900, ls: 1 });
  s += T(W - 80, 106, 24, `#${i}`, { mono: true, anchor: 'end', color: C.ink3, weight: 700 });
  s += T(80, 250, 24, eyebrow.toUpperCase(), { mono: true, color: eyebrowColor, weight: 700, ls: 4 });
  title.forEach((parts, k) => (s += T(76, 340 + k * 86, 78, parts, { glow: k === title.length - 1 })));
  const by = 340 + title.length * 86 + 20;
  body.forEach((txt, k) => (s += T(80, by + k * 44, 30, [[txt, C.ink2]], { weight: 600, ls: 0 })));
  s += `<g>${art}</g>`;
  s += `<line x1="80" y1="${H - 110}" x2="${W - 80}" y2="${H - 110}" stroke="#fff" stroke-opacity="0.08"/>`;
  s += T(80, H - 60, 30, [['Hold to zearn. ', C.ink], ['Never zero.', C.gold]], { weight: 900 }) + shield(472, H - 86, 1.15);
  s += T(W - 80, H - 60, 24, '@zearnvault · $ZEARN', { mono: true, anchor: 'end', color: C.ink2, weight: 700 });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${DEFS}${s}</svg>`;
}

// ---------- cards 11-20 (art lives in the right half: x 900..1540, y 150..720) ----------
const CURVE = [[0, 0], [0.25, 0.05], [0.5, 0.1], [1, 0.2], [2, 0.35], [4, 0.6], [6, 0.8], [8, 1]];
const CARDS = [
  // 11. start zearning in 3 steps
  () => card(11, {
    eyebrow: 'Start zearning',
    title: [[['Three steps.', C.ink]], [['Zero staking.', C.gold]]],
    body: ['No lockup contract, no deposit, no approval.', 'Your wallet balance is your position.'],
    art: [
      ['1', 'BUY', '$ZEARN on pump.fun', C.purple],
      ['2', 'HOLD', 'ZEC accrues every 5 min', C.green],
      ['3', 'CLAIM', 'in SOL, ZEC, USDC or NEAR', C.gold],
    ].map(([n, k, v, c], i) => {
      const y = 170 + i * 185;
      return `${box(930, y, 590, 155, c, C.panel, 2)}<circle cx="1010" cy="${y + 77}" r="46" fill="${c}" fill-opacity="0.15" stroke="${c}" stroke-width="3"/>${T(1010, y + 97, 54, n, { anchor: 'middle', color: c })}
        ${T(1085, y + 68, 40, k, { color: C.ink })}${T(1085, y + 110, 24, v, { mono: true, color: C.ink2, weight: 700, ls: 0 })}${i < 2 ? `<line x1="1010" y1="${y + 125}" x2="1010" y2="${y + 213}" stroke="${c}" stroke-width="3" stroke-dasharray="6 6"/>` : ''}`;
    }).join(''),
  }),
  // 12. the flywheel
  () => card(12, {
    eyebrow: 'The flywheel',
    title: [[['Volume feeds', C.ink]], [['the vault.', C.gold]]],
    body: ['Trades pay creator fees. Fees become ZEC.', 'ZEC backs the floor and pays holders.', 'Holders give people a reason to stay.'],
    art: (() => {
      const cx = 1225, cy = 445, R = 205;
      const nodes = [
        ['TRADES', 'buys + sells', C.purple, -90],
        ['FEES', 'SOL to vault', C.blue, 0],
        ['ZEC', 'via NEAR Intents', C.gold, 90],
        ['HOLDERS', 'floor + rewards', C.green, 180],
      ];
      const pos = (a) => [cx + R * Math.cos((a * Math.PI) / 180), cy + R * Math.sin((a * Math.PI) / 180)];
      const arcs = nodes.map((_, k) => {
        const a1 = nodes[k][3] + 24, a2 = nodes[(k + 1) % 4][3] - 24 + (k === 3 ? 360 : 0);
        const [x1, y1] = pos(a1), [x2, y2] = pos(a2);
        return `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)} A${R} ${R} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}" fill="none" stroke="${nodes[(k + 1) % 4][2]}" stroke-width="5" marker-end="url(#arr-${nodes[(k + 1) % 4][2].slice(1)})"/>`;
      }).join('');
      const pills = nodes.map(([k, v, c, a]) => {
        const [x, y] = pos(a);
        return `${box(x - 120, y - 52, 240, 104, c, C.panel, 3, 52)}${T(x, y - 2, 30, k, { anchor: 'middle', color: c })}${T(x, y + 30, 18, v, { mono: true, anchor: 'middle', color: C.ink2, weight: 700, ls: 0 })}`;
      }).join('');
      return `${arcs}${logo(cx, cy, 0.3)}${pills}`;
    })(),
  }),
  // 13. what moves the floor
  () => card(13, {
    eyebrow: 'What moves the floor',
    title: [[['Three things', C.ink]], [['push it up.', C.green]]],
    body: ['One thing pulls it down: ZEC price.', 'The floor is held in ZEC, so its dollar value', 'moves with Zcash, both ways.'],
    art: `${[
      ['VOLUME', 'every trade pays a fee, swept into ZEC', C.green, '▲'],
      ['ZEC PRICE UP', 'same ZEC, worth more dollars', C.green, '▲'],
      ['REDEEM FEES', '2% of every burn stays in the vault', C.green, '▲'],
      ['ZEC PRICE DOWN', 'same ZEC, worth fewer dollars', C.red, '▼'],
    ].map(([k, v, c, s], i) => {
      const y = 160 + i * 140;
      return `${box(930, y, 590, 118, c, C.panel, 2)}${T(985, y + 78, 52, s, { anchor: 'middle', color: c })}${T(1040, y + 54, 32, k, { color: C.ink })}${T(1040, y + 90, 20, v, { mono: true, color: C.ink2, weight: 700, ls: 0 })}`;
    }).join('')}`,
  }),
  // 14. sleep 8 hours meme
  () => card(14, {
    eyebrow: 'gm, holder',
    eyebrowColor: C.purple,
    title: [[['Sleep 8 hours.', C.ink]], [['Wake up 100%', C.gold]], [['unlocked.', C.gold]]],
    body: ['Hold Pool ZEC unlocks with lot age.', 'The laziest yield in crypto.'],
    art: (() => {
      const X0 = 960, X1 = 1500, Y0 = 640, Y1 = 310;
      const x = (h) => X0 + (h / 8) * (X1 - X0), y = (u) => Y0 - u * (Y0 - Y1);
      const line = CURVE.map(([h, u]) => `${x(h).toFixed(1)},${y(u).toFixed(1)}`).join(' ');
      const moon = `<g transform="translate(1000 215)"><circle r="34" fill="${C.gold2}"/><circle cx="16" cy="-12" r="30" fill="${C.panel}"/></g>${T(1058, 222, 26, 'z', { color: C.ink2 })}${T(1080, 202, 32, 'z', { color: C.ink2 })}${T(1108, 178, 40, 'Z', { color: C.ink })}`;
      const sun = `<g transform="translate(1460 215)"><circle r="30" fill="${C.gold}"/>${[0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<line x1="${42 * Math.cos(a * Math.PI / 180)}" y1="${42 * Math.sin(a * Math.PI / 180)}" x2="${54 * Math.cos(a * Math.PI / 180)}" y2="${54 * Math.sin(a * Math.PI / 180)}" stroke="${C.gold}" stroke-width="5" stroke-linecap="round"/>`).join('')}</g>`;
      return `${box(900, 140, 640, 590)}${moon}${sun}
        <line x1="${X0}" y1="${Y0}" x2="${X1}" y2="${Y0}" stroke="${C.line}" stroke-width="2"/>
        <polygon points="${X0},${Y0} ${line} ${X1},${Y0}" fill="${C.green}" fill-opacity="0.12"/><polyline points="${line}" fill="none" stroke="${C.green}" stroke-width="6" stroke-linejoin="round"/>
        ${CURVE.filter(([h]) => [0.25, 1, 4, 8].includes(h)).map(([h, u]) => `<circle cx="${x(h)}" cy="${y(u)}" r="8" fill="${C.green}"/>${T(x(h) - 14, y(u) - 12, 22, `${Math.round(u * 100)}%`, { mono: true, anchor: "end", color: C.ink, weight: 700 })}`).join('')}
        ${[[0, '0h'], [2, '2h'], [4, '4h'], [6, '6h'], [8, '8h']].map(([h, l]) => T(x(h), Y0 + 34, 20, l, { mono: true, anchor: 'middle', color: C.ink3, weight: 700 })).join('')}
        ${T(1220, 705, 20, 'sell early and the locked part goes back to the pool', { mono: true, anchor: 'middle', color: C.ink2, weight: 700, ls: 0 })}`;
    })(),
  }),
  // 15. sell or burn
  () => card(15, {
    eyebrow: 'Exit guide',
    title: [[['Sell or burn?', C.ink]], [['Check the floor.', C.gold]]],
    body: ['Burning is the emergency exit, not the', 'main door. When the price dips under the', 'floor, anyone can burn for ZEC, and that', 'pulls the price back toward it.'],
    art: `${box(1060, 160, 320, 110, C.ink2, C.panel, 2, 55)}${T(1220, 205, 22, 'MARKET PRICE', { mono: true, anchor: 'middle', color: C.ink2, weight: 700 })}${T(1220, 245, 26, 'vs ZEC FLOOR', { anchor: 'middle', color: C.gold })}
      <path d="M1160 272 C 1120 330, 1060 340, 1060 390" fill="none" stroke="${C.green}" stroke-width="5" marker-end="url(#arr-${C.green.slice(1)})"/>
      <path d="M1280 272 C 1320 330, 1380 340, 1380 390" fill="none" stroke="${C.red}" stroke-width="5" marker-end="url(#arr-${C.red.slice(1)})"/>
      ${box(910, 400, 300, 310, C.green, C.panel, 3)}${T(1060, 450, 22, 'ABOVE FLOOR', { mono: true, anchor: 'middle', color: C.green, weight: 700 })}${T(1060, 520, 48, 'SELL', { anchor: 'middle', color: C.ink })}${T(1060, 560, 22, 'on pump.fun', { mono: true, anchor: 'middle', color: C.ink2, weight: 700, ls: 0 })}${T(1060, 640, 20, 'the market pays', { mono: true, anchor: 'middle', color: C.ink3, weight: 700, ls: 0 })}${T(1060, 668, 20, 'more than the vault', { mono: true, anchor: 'middle', color: C.ink3, weight: 700, ls: 0 })}
      ${box(1230, 400, 300, 310, C.red, C.panel, 3)}${T(1380, 450, 22, 'BELOW FLOOR', { mono: true, anchor: 'middle', color: C.red, weight: 700 })}${T(1380, 520, 48, 'BURN', { anchor: 'middle', color: C.ink })}${T(1380, 560, 22, 'receive ZEC', { mono: true, anchor: 'middle', color: C.ink2, weight: 700, ls: 0 })}${T(1380, 640, 20, 'the vault pays', { mono: true, anchor: 'middle', color: C.ink3, weight: 700, ls: 0 })}${T(1380, 668, 20, 'more than the market', { mono: true, anchor: 'middle', color: C.ink3, weight: 700, ls: 0 })}`,
  }),
  // 16. zcash 101
  () => card(16, {
    eyebrow: 'Zcash in 30 seconds',
    eyebrowColor: C.gold,
    title: [[['The money', C.ink]], [['behind the floor.', C.gold]]],
    body: ['Zcash launched in 2016 with a hard cap of', '21M coins, like Bitcoin. Its twist: shielded', 'transactions, private by zero-knowledge', 'proofs (zk-SNARKs).'],
    art: `${zecMark(1060, 300, 120)}
      ${[
        ['2016', 'launched', C.ink],
        ['21M', 'max supply, ever', C.gold],
        ['~4 y', 'halving schedule', C.ink],
        ['zk', 'shielded payments', C.green],
      ].map(([k, v, c], i) => {
        const x = i % 2 ? 1240 : 930, y = i < 2 ? 470 : 600;
        return `${box(x, y, 290, 110, C.line, C.panel, 2)}${T(x + 24, y + 58, 42, k, { color: c })}${T(x + 24, y + 90, 18, v, { mono: true, color: C.ink2, weight: 700, ls: 0 })}`;
      }).join('')}
      ${T(1215, 250, 24, 'your payout:', { mono: true, color: C.ink2, weight: 700 })}${T(1215, 292, 30, 'claim ZEC,', { color: C.ink })}${T(1215, 332, 30, 'then shield it.', { color: C.gold })}`,
  }),
  // 17. near intents 101
  () => card(17, {
    eyebrow: 'NEAR Intents in 30 seconds',
    eyebrowColor: C.blue,
    title: [[['Say what you want.', C.ink]], [['Solvers deliver.', C.blue]]],
    body: ['An intent is an outcome, not a route:', '"turn this SOL into ZEC". Solvers compete', 'to fill it and the intents.near contract', 'settles it. No bridge UI to click through.'],
    art: `${box(930, 160, 590, 110, C.purple, C.panel, 2)}${T(960, 205, 18, 'INTENT', { mono: true, color: C.purple, weight: 700 })}${T(960, 245, 28, '"0.5 SOL in → max ZEC out"', { color: C.ink, ls: 0 })}
      ${[0, 1, 2].map((k) => `${box(930 + k * 200, 340, 190, 100, C.line, C.panel, 2)}${T(1025 + k * 200, 382, 20, `SOLVER ${'ABC'[k]}`, { mono: true, anchor: 'middle', color: C.ink2, weight: 700 })}${T(1025 + k * 200, 418, 22, ['0.0371 ZEC', '0.0374 ZEC', '0.0369 ZEC'][k], { mono: true, anchor: 'middle', color: k === 1 ? C.green : C.ink3, weight: 700, ls: 0 })}`).join('')}
      ${arrow(1225, 275, 1225, 330, C.purple)}
      <rect x="1130" y="336" width="190" height="108" rx="18" fill="none" stroke="${C.green}" stroke-width="3"/>${T(1225, 468, 18, 'best quote wins', { mono: true, anchor: 'middle', color: C.green, weight: 700 })}
      ${arrow(1225, 480, 1225, 530, C.green)}
      ${box(930, 540, 590, 160, C.blue, '#0f1420', 3)}${nearMark(1010, 620, 44)}${T(1080, 605, 26, 'intents.near settles it', { color: C.blue, ls: 0 })}${T(1080, 642, 18, 'one atomic swap, on-chain receipt', { mono: true, color: C.ink2, weight: 700, ls: 0 })}${T(1080, 672, 18, 'example quotes', { mono: true, color: C.ink3, weight: 700, ls: 0 })}`,
  }),
  // 18. glossary
  () => card(18, {
    eyebrow: 'Zearn glossary',
    title: [[['Speak zearn', C.ink]], [['in 8 words.', C.gold]]],
    body: ['Save this. Every word you will see on', 'the site, in one place.'],
    art: [
      ['SWEEP', 'fees in the vault wallet', 'swapped to ZEC', C.blue],
      ['FLOOR VAULT', '50% of the ZEC,', 'backs every token', C.gold],
      ['HOLD POOL', '50% of the ZEC,', 'paid to holders', C.green],
      ['EPOCH', '5-minute round', 'that shares the pool', C.green],
      ['LOT', 'each buy, with', 'its own age', C.ink2],
      ['FORFEIT', 'locked share of a sold', 'lot, back to the pool', C.red],
      ['REDEEM', 'burn for your share', 'of the vault, −2%', C.gold],
      ['LEDGER', 'every ZEC, checked', 'against intents.near', C.blue],
    ].map(([k, a, b, c], i) => {
      const x = i % 2 ? 1230 : 920, y = 150 + Math.floor(i / 2) * 142;
      return `${box(x, y, 295, 128, c, C.panel, 2)}${T(x + 20, y + 42, 24, k, { color: c, ls: 0 })}${T(x + 20, y + 78, 17, a, { mono: true, color: C.ink2, weight: 700, ls: 0 })}${T(x + 20, y + 104, 17, b, { mono: true, color: C.ink2, weight: 700, ls: 0 })}`;
    }).join(''),
  }),
  // 19. myths vs facts
  () => card(19, {
    eyebrow: 'Myth vs fact',
    title: [[['Four things', C.ink]], [['people get wrong.', C.gold]]],
    body: ['Quick answers to the questions', 'we get the most.'],
    art: [
      ['You have to stake to earn', 'Just hold. Your balance is your position.'],
      ['The floor is a fixed price', 'It is ZEC per token. It moves with ZEC.'],
      ['Sell early, lose everything', 'Only the still-locked share goes back.'],
      ['Burning is how you exit', 'Selling is the main door. Burn = emergency.'],
    ].map(([m, f], i) => {
      const y = 155 + i * 142;
      return `${box(920, y, 605, 128, C.line, C.panel, 2)}
        <circle cx="956" cy="${y + 40}" r="15" fill="${C.red}" fill-opacity="0.2" stroke="${C.red}" stroke-width="2"/>${T(956, y + 47, 20, '×', { anchor: 'middle', color: C.red })}
        ${T(985, y + 48, 24, m, { color: C.ink3, ls: 0 })}<line x1="985" y1="${y + 40}" x2="${985 + m.length * 11.6}" y2="${y + 40}" stroke="${C.red}" stroke-width="3"/>
        <circle cx="956" cy="${y + 90}" r="15" fill="${C.green}" fill-opacity="0.2" stroke="${C.green}" stroke-width="2"/><path d="M${948} ${y + 90} l6 6 l11 -12" fill="none" stroke="${C.green}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
        ${T(985, y + 98, 22, f, { color: C.ink, ls: 0 })}`;
    }).join(''),
  }),
  // 20. jeets welcome (meme)
  () => card(20, {
    eyebrow: 'A note to jeets',
    eyebrowColor: C.red,
    title: [[['Jeets welcome.', C.ink]], [['Thanks for the ZEC.', C.gold]]],
    body: ['Every sell pays a creator fee that becomes', 'ZEC in the vault. Sell early and your locked', 'Hold Pool share goes to the holders who', 'stayed. Paper hands fund diamond hands.'],
    art: (() => {
      const zig = Array.from({ length: 23 }, (_, k) => `${1010 + k * 20},${k % 2 ? 708 : 722}`).join(' ');
      return `<g transform="rotate(3 1225 430)">
        <path d="M1010 150 H1450 V708 L${zig.split(' ').reverse().join(' L')} Z" fill="#f2efe6"/>
        <polyline points="${zig}" fill="none" stroke="#f2efe6" stroke-width="2"/>
        ${T(1230, 210, 30, 'ZEARN VAULT', { anchor: 'middle', color: '#0a0a0e' })}${T(1230, 242, 16, 'receipt · paid by a jeet', { mono: true, anchor: 'middle', color: '#555', weight: 700, ls: 0 })}
        <line x1="1040" y1="266" x2="1420" y2="266" stroke="#0a0a0e" stroke-dasharray="6 6"/>
        ${[
          ['panic sell', '1'],
          ['creator fee → ZEC vault', '✓'],
          ['locked share → holders', '✓'],
          ['floor per token', '▲'],
          ['holders who stayed', 'happy'],
        ].map(([k, v], i) => `${T(1045, 310 + i * 48, 20, k, { mono: true, color: '#0a0a0e', weight: 700, ls: 0 })}${v === '✓' ? `<path d="M1398 ${302 + i * 48} l6 6 l11 -12" fill="none" stroke="#138a4c" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>` : T(1415, 310 + i * 48, 20, v, { mono: true, anchor: 'end', color: v === '▲' ? '#138a4c' : '#0a0a0e', weight: 700, ls: 0 })}`).join('')}
        <line x1="1040" y1="560" x2="1420" y2="560" stroke="#0a0a0e" stroke-dasharray="6 6"/>
        ${T(1230, 606, 26, 'THANK YOU FOR', { anchor: 'middle', color: '#0a0a0e' })}${T(1230, 640, 26, 'YOUR SERVICE', { anchor: 'middle', color: '#0a0a0e' })}
      </g>`;
    })(),
  }),
];

const only = process.argv.slice(2).map(Number).filter(Boolean);
CARDS.forEach((fn, k) => {
  const i = k + 11;
  if (only.length && !only.includes(i)) return;
  const png = new Resvg(fn(), { font: FONT, fitTo: { mode: 'width', value: W } }).render().asPng();
  writeFileSync(`${OUT}/${i}.png`, png);
  console.log(`card ${i}: ${(png.length / 1024).toFixed(0)} KB`);
});
