// Requires: npm i @resvg/resvg-js@2 (run from a folder where it is installed). Windows fonts: Segoe UI, Consolas.
// 10 content cards for X, 1600x900 PNG. node cards.mjs [indexes...]
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
  s += T(W - 80, 106, 24, `${String(i).padStart(2, '0')} / 10`, { mono: true, anchor: 'end', color: C.ink3, weight: 700 });
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

// ---------- the 10 cards (art lives in the right half: x 900..1520, y 170..760) ----------
const CARDS = [
  // 1. never zero hook
  () => card(1, {
    eyebrow: 'Never go to zero',
    title: [[['Most memecoins', C.ink]], [['go to zero.', C.red]], [['$ZEARN ', C.ink], ['has a floor.', C.gold]]],
    body: ['Every trade stacks ZEC in a public vault.', 'Burn anytime, take your share.'],
    art: (() => {
      const X0 = 930, X1 = 1500;
      const red = Array.from({ length: 60 }, (_, i) => { const u = i / 59; return `${X0 + (X1 - X0) * u},${260 + 380 * Math.pow(u, 1.5) + 14 * Math.sin(u * 30) * (1 - u)}`; }).join(' ');
      const gold = Array.from({ length: 60 }, (_, i) => { const u = i / 59; return `${X0 + (X1 - X0) * u},${u < 0.55 ? 300 + 300 * Math.pow(u / 0.55, 1.4) + 12 * Math.sin(u * 30) : 560 - 8 * Math.sin(u * 35)}`; }).join(' ');
      return `${box(900, 180, 640, 560)}<line x1="${X0}" y1="640" x2="${X1}" y2="640" stroke="${C.red}" stroke-opacity="0.6" stroke-width="2" stroke-dasharray="8 8"/>${T(X1, 670, 20, '$0', { mono: true, anchor: 'end', color: C.red })}
        <rect x="${X0}" y="568" width="${X1 - X0}" height="6" rx="3" fill="${C.gold}" opacity="0.5" filter="url(#glow)"/><line x1="${X0}" y1="571" x2="${X1}" y2="571" stroke="${C.gold2}" stroke-width="3" stroke-dasharray="12 8"/>${T(X0, 610, 20, 'ZEC FLOOR', { mono: true, color: C.gold })}
        <polyline points="${red}" fill="none" stroke="${C.red}" stroke-width="5" stroke-opacity="0.8"/><polyline points="${gold}" fill="none" stroke="${C.green}" stroke-width="6"/>
        ${T(X1, 230, 22, 'other memecoin', { mono: true, anchor: 'end', color: C.red })}${T(X1, 530, 22, '$ZEARN', { mono: true, anchor: 'end', color: C.green })}`;
    })(),
  }),
  // 2. where fees go
  () => card(2, {
    eyebrow: 'The engine',
    title: [[['Every trade', C.ink]], [['pays the vault.', C.gold]]],
    body: ['pump.fun creator fee: 0.30% – 0.95% of every', 'buy and sell. A keeper sweeps it every 5 minutes.'],
    art: `${box(930, 200, 250, 200)}${[0, 1, 2, 3, 4, 5].map((k) => `<rect x="${955 + k * 36}" y="${360 - [60, 110, 80, 140, 90, 120][k]}" width="22" height="${[60, 110, 80, 140, 90, 120][k]}" rx="3" fill="${k % 3 === 1 ? C.red : C.green}"/>`).join('')}${T(1055, 440, 22, 'PUMP.FUN TRADES', { mono: true, anchor: 'middle', color: C.ink2 })}
      ${arrow(1190, 300, 1290, 300)}${coin(1240, 260, 20, C.blue, 'S')}
      ${box(1300, 220, 220, 160, C.gold, '#15130c', 3)}${T(1410, 285, 26, 'VAULT', { anchor: 'middle', color: C.gold })}${T(1410, 320, 20, 'WALLET', { mono: true, anchor: 'middle', color: C.gold })}${T(1410, 355, 18, 'creator fees', { mono: true, anchor: 'middle', color: C.ink2 })}
      ${arrow(1410, 390, 1410, 500)}${T(1430, 455, 20, 'every 5 min', { mono: true, color: C.gold })}
      ${box(1250, 510, 270, 150, C.blue, '#0f1420', 3)}${T(1385, 575, 26, 'NEAR INTENTS', { anchor: 'middle', color: C.blue })}${T(1385, 615, 20, 'SOL → ZEC', { mono: true, anchor: 'middle', color: C.ink2 })}
      ${arrow(1240, 585, 1150, 585, C.gold)}${coin(1090, 585, 40, C.gold, 'Z')}${T(1090, 665, 22, 'ZEC VAULT', { mono: true, anchor: 'middle', color: C.gold })}`,
  }),
  // 3. why zcash
  () => card(3, {
    eyebrow: 'Why Zcash',
    eyebrowColor: C.gold,
    title: [[['Backed by ZEC,', C.ink]], [['not by promises.', C.gold]]],
    body: ['The floor is held in Zcash, a hard-capped coin', '(21M max). Your share is paid in ZEC, so the', 'floor moves with ZEC, up and down.'],
    art: `${zecMark(1215, 400, 170)}
      ${box(960, 620, 510, 110, C.gold, '#15130c', 2)}${T(1215, 668, 24, '21,000,000 ZEC max supply', { mono: true, anchor: 'middle', color: C.gold })}${T(1215, 705, 20, 'shield it yourself after payout', { mono: true, anchor: 'middle', color: C.ink2 })}`,
  }),
  // 4. why NEAR intents
  () => card(4, {
    eyebrow: 'Why NEAR Intents',
    eyebrowColor: C.blue,
    title: [[['SOL in. ZEC out.', C.ink]], [['Via NEAR Intents.', C.blue]]],
    body: ['No bridge of our own: NEAR Intents 1Click swaps', 'the fees to ZEC and pays holders out. The treasury', 'is a public balance on intents.near.'],
    art: `${nearMark(1215, 360, 150)}
      ${coin(960, 360, 34, C.blue, 'S')}${arrow(1000, 360, 1055, 360, C.blue)}${arrow(1375, 360, 1430, 360, C.gold)}${coin(1475, 360, 34, C.gold, 'Z')}
      ${box(940, 580, 560, 150)}${T(1220, 630, 22, 'PAYOUTS TO', { mono: true, anchor: 'middle', color: C.ink2 })}${T(1220, 680, 28, [['SOL · ', C.blue], ['ZEC · ', C.gold], ['USDC · ', C.ink], ['NEAR', C.blue]], { anchor: 'middle' })}`,
  }),
  // 5. the split
  () => card(5, {
    eyebrow: 'The split',
    title: [[['Half is the floor.', C.gold]], [['Half pays holders.', C.green]]],
    body: ['Every sweep splits 50/50: the Floor Vault backs', 'every token, the Hold Pool rewards people who hold.'],
    art: `${box(1110, 180, 220, 170, C.gold, '#15130c', 3)}<rect x="1124" y="220" width="192" height="116" rx="10" fill="url(#gold)"/>${T(1220, 210, 20, 'ZEC VAULT', { mono: true, anchor: 'middle', color: '#15130c' })}
      <path d="M1160 350 C 1120 420, 1060 430, 1060 480" fill="none" stroke="${C.gold}" stroke-width="10" stroke-linecap="round"/><path d="M1280 350 C 1320 420, 1380 430, 1380 480" fill="none" stroke="${C.green}" stroke-width="10" stroke-linecap="round"/>
      ${box(930, 490, 260, 230, C.gold, C.panel, 3)}<rect x="944" y="560" width="232" height="146" rx="10" fill="url(#gold)" opacity="0.85"/>${T(1060, 535, 34, 'FLOOR 50%', { anchor: 'middle', color: C.gold })}${T(1060, 650, 22, 'burn → ZEC', { mono: true, anchor: 'middle', color: '#15130c' })}
      ${box(1250, 490, 260, 230, C.green, C.panel, 3)}<rect x="1264" y="560" width="232" height="146" rx="10" fill="${C.green}" opacity="0.85"/>${T(1380, 535, 34, 'HOLD 50%', { anchor: 'middle', color: C.green })}${T(1380, 650, 22, 'hold → unlock', { mono: true, anchor: 'middle', color: '#0a2014' })}`,
  }),
  // 6. floor per token math
  () => card(6, {
    eyebrow: 'Floor math',
    title: [[['Your share of the', C.ink]], [['vault, in ZEC.', C.gold]]],
    body: ['floor per token = vault ZEC ÷ supply', 'Burn N tokens, receive N ÷ supply of the vault,', 'minus a 2% fee that stays for everyone else.'],
    art: `${box(930, 200, 580, 520, C.gold, '#15130c', 2)}
      ${T(975, 270, 24, 'EXAMPLE', { mono: true, color: C.gold })}
      ${T(975, 340, 34, [['Vault ', C.ink2], ['10 ZEC', C.gold]], { weight: 800 })}
      ${T(975, 395, 34, [['Supply ', C.ink2], ['1,000,000,000', C.ink]], { weight: 800 })}
      <line x1="975" y1="425" x2="1465" y2="425" stroke="${C.line}" stroke-width="2"/>
      ${T(975, 480, 30, [['1 token = ', C.ink2], ['0.00000001 ZEC', C.gold]], { weight: 800 })}
      ${T(975, 545, 30, [['Burn 20M (2%) → ', C.ink2]], { weight: 800 })}
      ${T(975, 600, 44, [['0.196 ZEC', C.green]], { weight: 900 })}
      ${T(975, 660, 22, '0.2 ZEC − 2% fee (stays in vault)', { mono: true, color: C.ink2 })}`,
  }),
  // 7. hold to unlock
  () => card(7, {
    eyebrow: 'Hold to unlock',
    title: [[['The longer you hold,', C.ink]], [['the more you zearn.', C.gold]]],
    body: ['Hold Pool ZEC accrues to every holder each epoch.', 'Claim with a signature, no burn, no transaction.'],
    art: (() => {
      const pts = [[0, 0], [0.25, 5], [0.5, 10], [1, 20], [2, 35], [4, 60], [6, 80], [8, 100]];
      const x = (h) => 960 + (h / 8) * 520, y = (v) => 680 - v * 4.4;
      const path = pts.map(([h, v], k) => `${k ? 'L' : 'M'}${x(h)},${y(v)}`).join(' ');
      return `${box(900, 180, 640, 560)}${[25, 50, 75, 100].map((v) => `<line x1="960" y1="${y(v)}" x2="1480" y2="${y(v)}" stroke="${C.line}"/>${T(948, y(v) + 7, 18, `${v}%`, { mono: true, anchor: 'end', color: C.ink3 })}`).join('')}
        <path d="${path} L1480,680 L960,680 Z" fill="${C.gold}" opacity="0.12"/><path d="${path}" fill="none" stroke="${C.gold}" stroke-width="5"/>
        ${[[0.25, '15m', 5], [1, '1h', 20], [4, '4h', 60], [8, '8h', 100]].map(([h, l, v]) => `<circle cx="${x(h)}" cy="${y(v)}" r="8" fill="#0a0a0e" stroke="${C.gold2}" stroke-width="3"/>${h === 8 ? T(x(h) - 16, y(v) - 16, 20, `${l} ${v}%`, { mono: true, anchor: 'end', color: C.ink }) : T(x(h) + 16, y(v) + 26, 20, `${l} ${v}%`, { mono: true, anchor: 'start', color: C.ink })}`).join('')}
        ${T(1480, 715, 18, 'hold time →', { mono: true, anchor: 'end', color: C.ink3 })}`;
    })(),
  }),
  // 8. paper hands pay diamond hands
  () => card(8, {
    eyebrow: 'Paper vs diamond',
    title: [[['Paper hands', C.ink]], [['pay diamond hands.', C.gold]]],
    body: ['Sell before your rewards unlock and the locked', 'part goes back to the pool, to the holders who stayed.'],
    art: `${box(910, 200, 290, 470, C.red)}<g transform="translate(1010 250)"><path d="M0 0 H60 L80 20 V100 H0 Z" fill="#e8e4d8"/><path d="M60 0 V20 H80" fill="#bdb8aa"/></g>${T(1055, 420, 30, 'PAPER', { anchor: 'middle' })}${T(1055, 455, 20, 'sold after 1 h', { mono: true, anchor: 'middle', color: C.ink2 })}
      <rect x="945" y="500" width="220" height="24" rx="12" fill="${C.panel}" stroke="${C.line}"/><rect x="945" y="500" width="44" height="24" rx="12" fill="${C.green}"/>${T(1055, 560, 18, '20% kept', { mono: true, anchor: 'middle', color: C.green })}${T(1055, 590, 18, '80% forfeited', { mono: true, anchor: 'middle', color: C.red })}
      <g transform="translate(1055 630) rotate(-10)"><rect x="-70" y="-26" width="140" height="52" rx="6" fill="none" stroke="${C.red}" stroke-width="4"/>${T(0, 12, 32, 'SOLD', { anchor: 'middle', color: C.red })}</g>
      ${[0, 1, 2, 3].map((k) => coin(1235 + k * 22, 360 - k * 30, 18, C.gold, 'Z')).join('')}${arrow(1210, 440, 1290, 440, C.gold)}
      ${box(1300, 200, 230, 470, C.gold, '#15130c', 3)}<g transform="translate(1415 290)"><polygon points="-46,-20 -22,-44 22,-44 46,-20 0,40" fill="${C.blue}"/><polygon points="-46,-20 46,-20 0,40" fill="#9cc4ff"/></g>${T(1415, 420, 30, 'DIAMOND', { anchor: 'middle', color: C.gold })}${T(1415, 455, 20, 'held 8 h', { mono: true, anchor: 'middle', color: C.ink2 })}${T(1415, 560, 50, '+bonus', { anchor: 'middle', color: C.green })}${T(1415, 600, 18, 'from forfeits', { mono: true, anchor: 'middle', color: C.green })}`,
  }),
  // 9. never zero arb loop
  () => card(9, {
    eyebrow: 'Never go to zero',
    eyebrowColor: C.red,
    title: [[['Dumped below', C.ink]], [['the floor?', C.red]], [['Bots buy it back.', C.green]]],
    body: ['Below the floor, burning pays more than selling.', 'Arb bots buy and burn until price meets the floor.', 'The floor is a safety net, not your entry price.'],
    art: (() => {
      const X0 = 930, X1 = 1510, F = 520;
      const yAt = (u) => (u < 0.45 ? 240 + 380 * Math.pow(u / 0.45, 1.4) : u < 0.6 ? 620 : u < 0.8 ? 620 - (620 - F + 10) * ((u - 0.6) / 0.2) : F - 10 - 6 * Math.sin(u * 40));
      const pts = Array.from({ length: 90 }, (_, i) => { const u = i / 89; return `${X0 + (X1 - X0) * u},${yAt(u)}`; }).join(' ');
      return `${box(900, 180, 640, 560)}<rect x="${X0}" y="${F - 3}" width="${X1 - X0}" height="6" rx="3" fill="${C.gold}" opacity="0.5" filter="url(#glow)"/><line x1="${X0}" y1="${F}" x2="${X1}" y2="${F}" stroke="${C.gold2}" stroke-width="3" stroke-dasharray="12 8"/>${T(X0, F - 14, 20, 'ZEC FLOOR', { mono: true, color: C.gold })}
        <rect x="${X0 + (X1 - X0) * 0.36}" y="${F}" width="${(X1 - X0) * 0.36}" height="130" fill="${C.red}" opacity="0.14"/>
        <polyline points="${pts}" fill="none" stroke="${C.green}" stroke-width="6" stroke-linejoin="round"/>
        ${[0, 1, 2].map((k) => `<g transform="translate(${1160 + k * 70} 690)"><rect x="-22" y="-18" width="44" height="36" rx="8" fill="${C.panel}" stroke="${C.purple}" stroke-width="3"/><rect x="-12" y="-6" width="8" height="8" fill="${C.purple}"/><rect x="4" y="-6" width="8" height="8" fill="${C.purple}"/></g>`).join('')}${T(1230, 728, 18, 'ARB BOTS: BUY + BURN', { mono: true, anchor: 'middle', color: C.purple })}`;
    })(),
  }),
  // 10. verify, don't trust
  () => card(10, {
    eyebrow: 'Verify, don\u2019t trust',
    title: [[['Every ZEC is', C.ink]], [['on the record.', C.gold]]],
    body: ['The treasury balance is public on intents.near.', 'Every sweep, claim and burn is in the ledger, and', 'the site checks ledger = on-chain balance live.'],
    art: `${box(900, 180, 640, 560)}
      ${T(940, 240, 22, 'LEDGER CHECK · EXAMPLE', { mono: true, color: C.gold })}
      ${[['Floor Vault', '0.00494912', C.gold], ['Hold Pool', '0.00471463', C.green], ['Payouts in flight', '0.00000000', C.ink2]].map(([k, v, c], n) => `${T(940, 305 + n * 55, 28, [[k, C.ink2]], { weight: 700 })}${T(1500, 305 + n * 55, 28, [[v, c]], { mono: true, anchor: 'end' })}`).join('')}
      <line x1="940" y1="455" x2="1500" y2="455" stroke="${C.line}" stroke-width="2"/>
      ${T(940, 505, 28, [['Ledger total', C.ink]], { weight: 900 })}${T(1500, 505, 28, [['0.00966375', C.ink]], { mono: true, anchor: 'end' })}
      ${T(940, 560, 28, [['On-chain (intents.near)', C.ink]], { weight: 900 })}${T(1500, 560, 28, [['0.00966375', C.ink]], { mono: true, anchor: 'end' })}
      <rect x="940" y="600" width="560" height="80" rx="14" fill="${C.green}" fill-opacity="0.12" stroke="${C.green}" stroke-width="2"/>${T(1220, 652, 30, 'MATCH', { anchor: 'middle', color: C.green })}`,
  }),
];

const only = process.argv.slice(2).map(Number).filter(Boolean);
CARDS.forEach((fn, k) => {
  const i = k + 1;
  if (only.length && !only.includes(i)) return;
  const png = new Resvg(fn(), { font: FONT, fitTo: { mode: 'width', value: W } }).render().asPng();
  writeFileSync(`${OUT}/${String(i).padStart(2, '0')}.png`, png);
  console.log(`card ${i}: ${(png.length / 1024).toFixed(0)} KB`);
});
