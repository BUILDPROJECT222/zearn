// Requires: npm i @resvg/resvg-js@2 (run from a folder where it is installed). Windows fonts: Segoe UI, Consolas.
// "How to claim" carousel for X: 4 cards, 1600x900 PNG. Same look as make-cards.mjs. node make-claim.mjs [indexes...]
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
  s += T(W - 80, 106, 24, `HOW TO CLAIM ${i}/4`, { mono: true, anchor: 'end', color: C.ink3, weight: 700 });
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

// ---------- "how to claim" carousel, 4 cards for one X post (art: x 900..1540, y 150..720) ----------
// Labels mirror the live site: sidebar "Hold", top-bar "Select Wallet", "Receive as" options from apps/web/src/dest.ts.
const SITE = 'zearn-production.up.railway.app';
/** mock browser frame with a sidebar; `active` = highlighted nav item; `inner` drawn in the content area (x 1075..1525) */
const browser = (active, inner, walletLabel = 'Select Wallet', walletHot = false) => {
  const nav = ['Dashboard', 'Vault', 'Emergency exit', 'Hold', 'How it works', 'Ledger'];
  return `${box(900, 150, 640, 570, C.line, '#0d0d12', 2, 16)}
    <rect x="900" y="150" width="640" height="44" rx="16" fill="#17171f"/><rect x="900" y="178" width="640" height="16" fill="#17171f"/>
    ${[0, 1, 2].map((k) => `<circle cx="${926 + k * 22}" cy="172" r="6" fill="${[C.red, C.gold, C.green][k]}" opacity="0.7"/>`).join('')}
    <rect x="1000" y="160" width="400" height="24" rx="12" fill="#0d0d12"/>${T(1200, 177, 14, `${SITE}/#/${active === 'Hold' ? 'hold' : ''}`, { mono: true, anchor: 'middle', color: C.ink3, weight: 700, ls: 0 })}
    <line x1="1060" y1="194" x2="1060" y2="720" stroke="${C.line}"/>
    ${logo(935, 225, 0.075)}${T(955, 231, 16, 'ZEARN', { color: C.ink, ls: 0 })}
    ${nav.map((n, k) => {
      const y = 270 + k * 40, on = n === active;
      return `${on ? `<rect x="910" y="${y - 22}" width="140" height="32" rx="8" fill="${C.gold}" fill-opacity="0.15" stroke="${C.gold}" stroke-width="2"/>` : ''}${T(922, y, 15, n, { color: on ? C.gold : C.ink2, weight: on ? 900 : 700, ls: 0 })}`;
    }).join('')}
    <rect x="1370" y="208" width="155" height="36" rx="8" fill="${walletHot ? C.purple : '#512da8'}" ${walletHot ? `stroke="${C.gold2}" stroke-width="3"` : ''}/>${T(1447, 232, 15, walletLabel, { anchor: 'middle', color: '#fff', ls: 0 })}
    ${inner}`;
};
const pointer = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})"><path d="M0 0 L0 34 L9 26 L16 42 L22 39 L15 24 L27 24 Z" fill="#fff" stroke="#000" stroke-width="2" stroke-linejoin="round"/></g>`;
const badge = (x, y, n, c = C.gold) => `<circle cx="${x}" cy="${y}" r="22" fill="${c}"/>${T(x, y + 9, 26, String(n), { anchor: 'middle', color: '#0a0a0e' })}`;
const row = (y, k, v, c = C.ink) => `${T(1085, y, 16, k, { color: C.ink2, weight: 700, ls: 0 })}${T(1515, y, 17, v, { mono: true, anchor: 'end', color: c, weight: 700, ls: 0 })}`;

const CARDS = [
  // 1. overview
  () => card(1, {
    eyebrow: 'How to claim · Hold Pool',
    title: [[['Claim your ZEC', C.ink]], [['in 4 steps.', C.gold]]],
    body: ['Holding $ZEARN accrues ZEC every 5 minutes.', 'Claiming takes one free signature.', 'Your tokens never leave your wallet.'],
    art: [
      ['Open the site, go to Hold', SITE, C.ink2],
      ['Connect your Solana wallet', 'Phantom, Solflare, Backpack…', C.purple],
      ['Pick how you get paid', 'SOL · ZEC · USDC · NEAR', C.blue],
      ['Sign the message, claim', 'free, not a transaction', C.green],
    ].map(([k, v, c], i) => {
      const y = 160 + i * 142;
      return `${box(930, y, 590, 120, c, C.panel, 2)}${badge(985, y + 60, i + 1, c === C.ink2 ? C.gold : c)}${T(1030, y + 54, 30, k, { color: C.ink })}${T(1030, y + 90, 20, v, { mono: true, color: C.ink2, weight: 700, ls: 0 })}`;
    }).join(''),
  }),
  // 2. open Hold + connect wallet
  () => card(2, {
    eyebrow: 'Steps 1 + 2',
    title: [[['Open Hold.', C.ink]], [['Connect wallet.', C.gold]]],
    body: ['Tap Hold in the sidebar, then Select Wallet', 'at the top right. Use the wallet that holds', 'your $ZEARN. You see your balance, total', 'accrued and what is claimable now.'],
    art: browser('Hold', `
      ${T(1085, 290, 20, 'Hold rewards, no burn required', { color: C.ink, ls: 0 })}
      <rect x="1080" y="310" width="445" height="140" rx="10" fill="${C.panel}" stroke="${C.line}"/>
      ${row(345, 'Recorded balance', '2,500,000 ZEARN')}${row(385, 'Total accrued', '0.00182 ZEC')}${row(425, 'Claimable now', '0.00109 ZEC', C.gold)}
      ${[['LOT', 1085], ['HELD', 1150], ['UNLOCKED', 1230]].map(([t, x]) => T(x, 490, 15, t, { mono: true, color: C.ink3, weight: 700, ls: 0 })).join('')}
      ${[['#1', 1085], ['4.2 h', 1150], ['60%', 1230]].map(([t, x]) => T(x, 520, 15, t, { mono: true, color: C.ink2, weight: 700, ls: 0 })).join('')}<rect x="1300" y="508" width="200" height="10" rx="5" fill="#1b1b24"/><rect x="1300" y="508" width="120" height="10" rx="5" fill="${C.green}"/>
      ${T(1085, 690, 14, 'example numbers', { mono: true, color: C.ink3, weight: 700, ls: 0 })}
      ${badge(878, 378, 1)}${pointer(1012, 378, 0.75)}${badge(1338, 226, 2)}${pointer(1470, 232)}`, 'Select Wallet', true),
  }),
  // 3. pick how you get paid
  () => card(3, {
    eyebrow: 'Step 3',
    title: [[['Pick how you', C.ink]], [['get paid.', C.gold]]],
    body: ['Use "Receive as". The first three go straight', 'to the connected wallet. ZEC to a Zcash', 'address needs a t1… or t3… address', '(shield it yourself afterwards).'],
    art: `${box(900, 150, 640, 570)}
      ${T(935, 205, 18, 'RECEIVE AS', { mono: true, color: C.ink2, weight: 700 })}
      ${DEST_ROWS.map(([k, v, c], i) => {
        const y = 225 + i * 94, on = i === 0;
        return `<rect x="930" y="${y}" width="580" height="80" rx="10" fill="${on ? c : C.panel}" fill-opacity="${on ? 0.14 : 1}" stroke="${on ? c : C.line}" stroke-width="${on ? 3 : 2}"/>
          <circle cx="966" cy="${y + 40}" r="11" fill="none" stroke="${c}" stroke-width="3"/>${on ? `<circle cx="966" cy="${y + 40}" r="5" fill="${c}"/>` : ''}
          ${T(992, y + 36, 22, k, { color: C.ink, ls: 0 })}${T(992, y + 64, 16, v, { mono: true, color: C.ink2, weight: 700, ls: 0 })}`;
      }).join('')}`,
  }),
  // 4. sign + claim
  () => card(4, {
    eyebrow: 'Step 4',
    title: [[['Sign. Claim.', C.ink]], [['ZEC on the way.', C.green]]],
    body: ['Press Claim, then sign the message in your', 'wallet. It is free: no transaction, no gas,', 'no token approval. Minimum claim ≈ $1.', 'Status goes paying → paid in about a minute.'],
    art: `${box(900, 150, 640, 330, C.purple, '#120f1a', 3)}
      ${T(935, 200, 18, 'WALLET · SIGNATURE REQUEST', { mono: true, color: C.purple, weight: 700 })}
      <rect x="935" y="220" width="570" height="140" rx="10" fill="#0d0d12" stroke="${C.line}"/>
      ${T(955, 256, 16, 'ZEARN hold claim', { mono: true, color: C.ink, weight: 700, ls: 0 })}${T(955, 284, 16, 'wallet: 7xKp…9fQa', { mono: true, color: C.ink2, weight: 700, ls: 0 })}${T(955, 312, 16, 'dest: SOL:7xKp…9fQa', { mono: true, color: C.ink2, weight: 700, ls: 0 })}${T(955, 340, 16, 'nonce: 4f1c…', { mono: true, color: C.ink3, weight: 700, ls: 0 })}
      <rect x="935" y="385" width="275" height="64" rx="10" fill="#1b1b24"/>${T(1072, 426, 22, 'Cancel', { anchor: 'middle', color: C.ink2 })}
      <rect x="1230" y="385" width="275" height="64" rx="10" fill="${C.purple}" stroke="${C.gold2}" stroke-width="3"/>${T(1367, 426, 22, 'Sign', { anchor: 'middle', color: '#fff' })}${pointer(1400, 420)}
      ${box(900, 510, 640, 210)}
      ${T(935, 555, 18, 'YOUR CLAIMS', { mono: true, color: C.ink2, weight: 700 })}
      ${[['#12', 935], ['0.00109 ZEC', 1000], ['SOL', 1170]].map(([t, x]) => T(x, 605, 20, t, { mono: true, color: C.ink, weight: 700, ls: 0 })).join('')}<rect x="1320" y="583" width="90" height="30" rx="15" fill="${C.gold}" fill-opacity="0.2"/>${T(1365, 604, 16, 'paying', { mono: true, anchor: 'middle', color: C.gold, weight: 700, ls: 0 })}${T(1430, 604, 20, '→', { color: C.ink2 })}<rect x="1455" y="583" width="70" height="30" rx="15" fill="${C.green}" fill-opacity="0.2"/>${T(1490, 604, 16, 'paid', { mono: true, anchor: 'middle', color: C.green, weight: 700, ls: 0 })}
      ${T(935, 665, 17, 'Only the unlocked part is claimable. Claim again', { color: C.ink2, weight: 700, ls: 0 })}${T(935, 692, 17, 'anytime as more unlocks. Example numbers.', { color: C.ink2, weight: 700, ls: 0 })}`,
  }),
];
const DEST_ROWS = [
  ['SOL to this wallet', 'swapped via NEAR Intents · ~10 s', C.blue],
  ['ZEC (SPL) to this wallet', 'ZEC token on Solana · ~10 s', C.gold],
  ['USDC to this wallet', 'swapped to USDC on Solana · ~10 s', C.green],
  ['ZEC to a Zcash address', 't1… / t3… · ~2 min · fee ≈ 0.0003 ZEC', C.gold],
  ['NEAR to a NEAR account', 'yourname.near · ~10 s', C.blue],
];

const only = process.argv.slice(2).map(Number).filter(Boolean);
CARDS.forEach((fn, k) => {
  const i = k + 1;
  if (only.length && !only.includes(i)) return;
  const png = new Resvg(fn(), { font: FONT, fitTo: { mode: 'width', value: W } }).render().asPng();
  writeFileSync(`${OUT}/claim-${i}.png`, png);
  console.log(`claim-${i}.png ${(png.length / 1024).toFixed(0)} KB`);
});
