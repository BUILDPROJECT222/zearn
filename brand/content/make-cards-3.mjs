// Requires: npm i @resvg/resvg-js@2 (run from a folder where it is installed). Windows fonts: Segoe UI, Consolas.
// Content cards 21-30 for X, 1600x900 PNG. Same look as make-cards.mjs. node make-cards-3.mjs [indexes...]
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

// ---------- cards 21-30 (art lives in the right half: x 900..1540, y 150..720) ----------
// Facts mirror the code: keeper loops in apps/backend/src/index.ts, lot rules in holdpool.ts, risks in apps/web/src/pages/Risks.tsx.
const check = (x, y, c = C.green, s = 1) => `<path d="M${x - 8 * s} ${y} l${6 * s} ${6 * s} l${11 * s} -${12 * s}" fill="none" stroke="${c}" stroke-width="${3.5 * s}" stroke-linecap="round" stroke-linejoin="round"/>`;
const cross = (x, y, c = C.red, s = 1) => `<path d="M${x - 7 * s} ${y - 7 * s} l${14 * s} ${14 * s} M${x + 7 * s} ${y - 7 * s} l-${14 * s} ${14 * s}" stroke="${c}" stroke-width="${3.5 * s}" stroke-linecap="round"/>`;
const bar = (x, y, w, f, c = C.green, h = 14) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="#1b1b24"/><rect x="${x}" y="${y}" width="${Math.max(h, w * f)}" height="${h}" rx="${h / 2}" fill="${c}"/>`;
const small = (x, y, t, c = C.ink2, opt = {}) => T(x, y, opt.size ?? 18, t, { mono: true, color: c, weight: 700, ls: 0, ...opt });
const LOTS = [
  ['#1', 'bought 9 h ago', 1.0],
  ['#2', 'bought 3 h ago', 0.475],
  ['#3', 'bought 10 min ago', 0.033],
];

const CARDS = [
  // 21. three chains, one coin
  () => card(21, {
    eyebrow: 'Under the hood',
    title: [[['Three chains.', C.ink]], [['One coin.', C.gold]]],
    body: ['You trade on Solana. The swaps settle on', 'NEAR. The floor is held in Zcash.', 'You only ever touch the first one.'],
    art: [
      ['SOLANA', 'where you trade', ['$ZEARN on pump.fun', 'creator fees in SOL'], C.purple],
      ['NEAR', 'where it settles', ['Intents swap SOL → ZEC', 'treasury on intents.near'], C.blue],
      ['ZCASH', 'what backs it', ['ZEC floor vault', 'ZEC Hold Pool rewards'], C.gold],
    ].map(([k, v, lines, c], i) => {
      const y = 155 + i * 190;
      return `${box(930, y, 590, 160, c, C.panel, 3)}${T(960, y + 56, 36, k, { color: c })}${small(960, y + 90, v, C.ink3)}
        ${lines.map((l, j) => small(1230, y + 62 + j * 40, `· ${l}`, C.ink, { size: 19 })).join('')}
        ${i < 2 ? arrow(1225, y + 164, 1225, y + 186, [C.blue, C.gold][i]) : ''}`;
    }).join(''),
  }),
  // 22. the keeper never sleeps
  () => card(22, {
    eyebrow: 'The keeper',
    title: [[['It never sleeps.', C.ink]], [['So you can.', C.gold]]],
    body: ['An automated keeper runs the whole loop,', 'day and night. Every step lands in the', 'public ledger on the site.'],
    art: [
      ['every 5 min', 'SWEEP', 'vault fees (0.1 SOL+) swapped to ZEC', C.blue],
      ['every 5 min', 'EPOCH', 'Hold Pool shared across holders', C.green],
      ['every 60 s', 'BURN SCAN', 'new redeems picked up on-chain', C.red],
      ['every 60 s', 'RECOVERY', 'stuck swaps settled, payouts retried', C.gold],
    ].map(([t, k, v, c], i) => {
      const y = 155 + i * 142;
      return `${box(930, y, 590, 124, c, C.panel, 2)}<circle cx="990" cy="${y + 62}" r="34" fill="none" stroke="${c}" stroke-width="4"/><line x1="990" y1="${y + 62}" x2="990" y2="${y + 40}" stroke="${c}" stroke-width="4" stroke-linecap="round"/><line x1="990" y1="${y + 62}" x2="1006" y2="${y + 70}" stroke="${c}" stroke-width="4" stroke-linecap="round"/>
        ${small(1050, y + 40, t.toUpperCase(), c)}${T(1050, y + 80, 30, k, { color: C.ink })}${small(1050, y + 108, v, C.ink2, { size: 16 })}`;
    }).join(''),
  }),
  // 23. every buy is a lot
  () => card(23, {
    eyebrow: 'Hold Pool · lots',
    title: [[['Buying more never', C.ink]], [['resets your clock.', C.green]]],
    body: ['Every buy opens a new lot with its own clock.', 'Old lots keep unlocking. A new lot only', 'shares fees that arrive after it lands,', 'so nobody can buy in and skim the pool.'],
    art: `${box(900, 150, 640, 570)}${small(935, 200, 'ONE WALLET, THREE BUYS', C.green, { size: 20 })}
      ${LOTS.map(([n, when, f], i) => {
        const y = 250 + i * 140;
        return `${T(935, y + 30, 30, `Lot ${n}`, { color: C.ink })}${small(1085, y + 28, when, C.ink2)}${T(1505, y + 30, 28, `${Math.round(f * 100)}%`, { mono: true, anchor: 'end', color: C.green })}${bar(935, y + 55, 570, f)}${small(935, y + 100, ['fully unlocked, claim anytime', 'still unlocking on its own clock', 'fresh clock, starts at 0%'][i], C.ink3, { size: 16 })}`;
      }).join('')}`,
  }),
  // 24. LIFO
  () => card(24, {
    eyebrow: 'Hold Pool · selling',
    title: [[['Sells cut your', C.ink]], [['newest lot first.', C.gold]]],
    body: ['Your oldest, most-unlocked lots survive a sell.', 'Unlocked ZEC you have not claimed yet stays', 'yours. Only the still-locked part of a sold', 'lot goes back to the pool.'],
    art: `${box(900, 150, 640, 570)}${small(935, 200, 'SELL HALF THE BAG', C.gold, { size: 20 })}
      ${LOTS.map(([n, when, f], i) => {
        const y = 250 + i * 140, cut = i === 2 ? 1 : i === 1 ? 0.5 : 0;
        return `${T(935, y + 30, 30, `Lot ${n}`, { color: cut === 1 ? C.ink3 : C.ink })}${small(1085, y + 28, when, C.ink2)}
          ${T(1505, y + 30, 22, cut === 1 ? 'SOLD FIRST' : cut ? 'PARTLY SOLD' : 'UNTOUCHED', { mono: true, anchor: 'end', color: cut === 1 ? C.red : cut ? C.gold : C.green, weight: 700 })}
          <rect x="935" y="${y + 55}" width="570" height="30" rx="8" fill="${C.green}" fill-opacity="0.8"/>${cut ? `<rect x="${935 + 570 * (1 - cut)}" y="${y + 55}" width="${570 * cut}" height="30" rx="8" fill="${C.red}" fill-opacity="0.85"/><line x1="${935 + 570 * (1 - cut)}" y1="${y + 45}" x2="${935 + 570 * (1 - cut)}" y2="${y + 95}" stroke="#fff" stroke-width="3" stroke-dasharray="5 4"/>` : ''}
          ${small(935, y + 115, ['oldest lot: kept whole', 'half cut, half kept', 'newest lot: cut entirely'][i], C.ink3, { size: 16 })}`;
      }).join('')}`,
  }),
  // 25. don't shuffle wallets
  () => card(25, {
    eyebrow: 'Pro tip',
    eyebrowColor: C.red,
    title: [[['Don’t shuffle', C.ink]], [['your bag.', C.red]]],
    body: ['Moving tokens between your own wallets looks', 'like a sell and a buy, so the clock restarts', 'at 0%. Claim first. Unlocked ZEC stays', 'claimable from the old wallet either way.'],
    art: `${box(920, 200, 260, 300, C.green, C.panel, 3)}${T(1050, 250, 26, 'WALLET A', { anchor: 'middle', color: C.green })}${T(1050, 340, 64, '100%', { anchor: 'middle', color: C.ink })}${small(1050, 380, 'held 8 h', C.ink2, { anchor: 'middle' })}${bar(950, 420, 200, 1)}
      ${arrow(1190, 350, 1270, 350, C.red)}${small(1230, 330, 'move', C.red, { anchor: 'middle' })}
      ${box(1280, 200, 260, 300, C.red, C.panel, 3)}${T(1410, 250, 26, 'WALLET B', { anchor: 'middle', color: C.red })}${T(1410, 340, 64, '0%', { anchor: 'middle', color: C.ink })}${small(1410, 380, 'clock restarts', C.ink2, { anchor: 'middle' })}${bar(1310, 420, 200, 0, C.red)}
      ${box(920, 540, 620, 150, C.gold, '#15130c', 2)}${T(950, 595, 26, 'Do this instead', { color: C.gold })}${small(950, 632, '1. claim what is unlocked in wallet A', C.ink)}${small(950, 664, '2. then move, if you really have to', C.ink)}`,
  }),
  // 26. who counts as a holder
  () => card(26, {
    eyebrow: 'Hold Pool · eligibility',
    title: [[['Who gets the', C.ink]], [['Hold Pool?', C.green]]],
    body: ['Real holders only. Tokens sitting in the', 'bonding curve, AMM pools or program', 'accounts are left out, so eligible supply', 'is smaller and every holder’s share is bigger.'],
    art: `${box(920, 160, 610, 260, C.green, C.panel, 3)}${T(950, 210, 26, 'COUNTED', { color: C.green })}
      ${['Your wallet (Phantom, Solflare, Backpack…)', 'Any regular Solana wallet', 'Hardware wallets'].map((t, i) => `${check(962, 262 + i * 52)}${small(990, 268 + i * 52, t, C.ink, { size: 19 })}`).join('')}
      ${box(920, 440, 610, 270, C.red, C.panel, 3)}${T(950, 490, 26, 'LEFT OUT', { color: C.red })}
      ${['pump.fun bonding curve', 'AMM / liquidity pool accounts', 'Program-owned accounts (PDAs)', 'The Zearn vault wallet itself'].map((t, i) => `${cross(962, 536 + i * 44)}${small(990, 542 + i * 44, t, C.ink2, { size: 19 })}`).join('')}`,
  }),
  // 27. bots welcome
  () => card(27, {
    eyebrow: 'For bots and power users',
    eyebrowColor: C.blue,
    title: [[['Bots welcome.', C.ink]], [['No UI needed.', C.blue]]],
    body: ['When the price sits under the floor, burning', 'pays more than selling. Any wallet or bot', 'can redeem straight on-chain: burn with', 'a memo, and the keeper does the rest.'],
    art: `${box(900, 150, 640, 570, C.line, '#0b0b10', 2)}
      ${[0, 1, 2].map((k) => `<circle cx="${930 + k * 22}" cy="182" r="6" fill="${[C.red, C.gold, C.green][k]}" opacity="0.7"/>`).join('')}${small(1010, 188, 'redeem.sh', C.ink3)}
      ${[
        ['# 1. check the payout first', C.ink3],
        ['GET /api/redeem/preview', C.blue],
        ['    ?amount=500000&kind=SOL', C.blue],
        ['→ { ok: true, payout: … }', C.green],
        ['', C.ink],
        ['# 2. one Solana transaction', C.ink3],
        ['burnChecked($ZEARN, amount)', C.gold],
        ['memo  "ZEARN:SOL:<your wallet>"', C.gold],
        ['', C.ink],
        ['# 3. keeper finds it (~60 s)', C.ink3],
        ['→ pro-rata ZEC − 2%, paid out', C.green],
      ].map(([t, c], i) => small(935, 240 + i * 42, t, c, { size: 21 })).join('')}`,
  }),
  // 28. shield your payout
  () => card(28, {
    eyebrow: 'Zcash privacy',
    eyebrowColor: C.gold,
    title: [[['Claim ZEC.', C.ink]], [['Then go private.', C.gold]]],
    body: ['Payouts land at a transparent t1 or t3', 'address. One tap in your own Zcash wallet', 'moves them into the shielded pool, where', 'amounts and addresses stay private.'],
    art: [
      ['1', 'Copy a t-address', 'from your Zcash wallet (Zashi, Ywallet…)', C.ink2],
      ['2', 'Claim as "ZEC to a Zcash address"', 'arrives in about 2 minutes', C.gold],
      ['3', 'Tap Shield in your wallet', 'your ZEC joins the shielded pool', C.green],
    ].map(([n, k, v, c], i) => {
      const y = 170 + i * 180;
      return `${box(930, y, 590, 150, c === C.ink2 ? C.line : c, C.panel, 2)}<circle cx="995" cy="${y + 75}" r="36" fill="${c === C.ink2 ? C.gold : c}"/>${T(995, y + 92, 44, n, { anchor: 'middle', color: '#0a0a0e' })}
        ${T(1055, y + 68, 26, k, { color: C.ink, ls: 0 })}${small(1055, y + 104, v, C.ink2)}${i === 2 ? shield(1470, y + 55, 1.6) : ''}`;
    }).join(''),
  }),
  // 29. risks, honestly
  () => card(29, {
    eyebrow: 'Risks, said out loud',
    eyebrowColor: C.red,
    title: [[['Read this', C.ink]], [['before you ape.', C.red]]],
    body: ['A floor is a safety net, not a promise.', 'The full list lives on the site under', 'Risks & terms.'],
    art: [
      ['Custody', 'the keeper holds the vault keys in v1', 'roadmap: Chain Signatures / TEE keeper'],
      ['ZEC volatility', 'the floor is in ZEC', 'its dollar value falls when ZEC falls'],
      ['Thin floor early', 'the vault backs a small part of market cap', 'at first; it grows with volume'],
      ['Bridge dependency', 'swaps and payouts run on NEAR Intents', 'delays there delay claims and redeems'],
    ].map(([k, a, b], i) => {
      const y = 155 + i * 142;
      return `${box(920, y, 605, 124, C.red, C.panel, 2)}<path d="M${962} ${y + 34} l22 38 h-44 z" fill="none" stroke="${C.gold}" stroke-width="3.5" stroke-linejoin="round"/>${T(962, y + 66, 22, '!', { anchor: 'middle', color: C.gold })}
        ${T(1010, y + 44, 26, k, { color: C.ink, ls: 0 })}${small(1010, y + 76, a, C.ink2, { size: 16 })}${small(1010, y + 102, b, C.ink3, { size: 16 })}`;
    }).join(''),
  }),
  // 30. memecoins vs zearn
  () => card(30, {
    eyebrow: 'Spot the difference',
    title: [[['Same memes.', C.ink]], [['More Zcash.', C.gold]]],
    body: ['Same pump.fun launch, same chart, same', 'group chat energy. Plus a vault full of ZEC', 'and a reason to keep holding.'],
    art: `${box(900, 150, 640, 570)}
      ${T(1160, 210, 22, 'MOST MEMECOINS', { mono: true, anchor: 'middle', color: C.ink3, weight: 700 })}${T(1400, 210, 22, '$ZEARN', { mono: true, anchor: 'middle', color: C.gold, weight: 700 })}
      ${[
        ['Backing', 'none', 'ZEC vault'],
        ['Rewards', 'nothing', 'ZEC / 5 min'],
        ['Exit', 'sell only', 'sell or burn'],
        ['Books', 'trust me', 'public ledger'],
        ['Floor', '$0', 'ZEC per token'],
      ].map(([k, a, b], i) => {
        const y = 240 + i * 92;
        return `<line x1="930" y1="${y}" x2="1510" y2="${y}" stroke="#fff" stroke-opacity="0.07"/>${T(935, y + 55, 22, k, { color: C.ink2, ls: 0 })}
          ${cross(1075, y + 47, C.red, 0.8)}${small(1095, y + 54, a, C.ink3, { size: 20 })}
          ${check(1318, y + 47, C.green, 0.9)}${small(1340, y + 54, b, C.ink, { size: 20 })}`;
      }).join('')}`,
  }),
];

const only = process.argv.slice(2).map(Number).filter(Boolean);
CARDS.forEach((fn, k) => {
  const i = k + 21;
  if (only.length && !only.includes(i)) return;
  const png = new Resvg(fn(), { font: FONT, fitTo: { mode: 'width', value: W } }).render().asPng();
  writeFileSync(`${OUT}/${i}.png`, png);
  console.log(`card ${i}: ${(png.length / 1024).toFixed(0)} KB`);
});
