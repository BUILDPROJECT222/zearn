// Proof cards for X, built from LIVE data (site API + NEAR Intents 1Click status). 1600x900 PNG.
// Requires: npm i @resvg/resvg-js@2 (run from a folder where it is installed). Windows fonts: Segoe UI, Consolas.
// node make-proof.mjs            -> renders proof-1..5.png and prints the numbers used
import { Resvg } from '@resvg/resvg-js';
import { mkdirSync, writeFileSync } from 'node:fs';

const SITE = 'https://zearn-production.up.railway.app';
const ONECLICK = 'https://1click.chaindefuser.com/v0/status?depositAddress=';
const OUT = 'E:/project/near/brand/proof';
mkdirSync(OUT, { recursive: true });

// ---------- live data ----------
const get = async (u) => {
  const r = await fetch(u, { headers: { 'user-agent': 'zearn-proof' } });
  if (!r.ok) throw new Error(`${u} -> HTTP ${r.status}`);
  return r.json();
};
const state = await get(`${SITE}/api/state`);
const sweeps = (await get(`${SITE}/api/sweeps?limit=50`)).filter((s) => s.status === 'success').reverse();
const accruals = (await get(`${SITE}/api/accruals?limit=50`)).filter((a) => Number(a.hold_in_raw) > 0);
const redeems = (await get(`${SITE}/api/redeems?limit=50`)).filter((r) => r.status === 'paid').reverse();
const sweep = sweeps[0];
const redeem = redeems[0];
const acc = accruals[0];
if (!sweep || !redeem || !acc) throw new Error('need at least one successful sweep, paid redeem and funded epoch');
const sw = (await get(ONECLICK + sweep.deposit_address)).swapDetails;
const sweepQuote = await get(ONECLICK + sweep.deposit_address);
const payDep = redeem.payout_ref.split(':')[1];
const pay = (await get(ONECLICK + payDep)).swapDetails;
const sweepSecs = Math.round((Date.parse(sweepQuote.updatedAt) - Date.parse(sweepQuote.quoteResponse.timestamp)) / 1000);

const z8 = (raw) => (Number(raw) / 1e8).toFixed(8);
const usd2 = (x) => `$${Number(x).toFixed(2)}`;
const sh = (s, n = 4) => `${s.slice(0, n)}…${s.slice(-n)}`;
const tokens = (raw) => Math.round(Number(raw) / 1e6).toLocaleString('en-US');
const D = {
  sweepSol: Number(sw.amountInFormatted).toFixed(4),
  sweepSolUsd: usd2(sw.amountInUsd),
  sweepZec: sw.amountOutFormatted,
  sweepZecUsd: usd2(sw.amountOutUsd),
  sweepSecs,
  sweepTx: sw.originChainTxHashes[0].hash,
  sweepIntent: sw.intentHashes[0],
  sweepFloor: z8(sweep.floor_raw),
  sweepHold: z8(sweep.hold_raw),
  burnTokens: tokens(redeem.amount_raw),
  burnTx: redeem.signature,
  burnGross: z8(redeem.gross_raw),
  burnFee: z8(redeem.fee_raw),
  burnPayout: z8(redeem.payout_raw),
  paySol: Number(pay.amountOutFormatted).toFixed(8),
  payUsd: usd2(pay.amountOutUsd),
  payTx: pay.destinationChainTxHashes[0]?.hash ?? '',
  // cumulative over all funded epochs: forfeits are recycled into later epochs, so "net" = in - forfeited (no double count)
  accEpochs: accruals.length,
  accIn: z8(accruals.reduce((a, e) => a + Number(e.hold_in_raw), 0)),
  accForfeit: z8(accruals.reduce((a, e) => a + Number(e.forfeited_raw), 0)),
  accNet: z8(accruals.reduce((a, e) => a + Number(e.hold_in_raw) - Number(e.forfeited_raw), 0)),
  accHolders: acc.holders_count,
  sweepCount: sweeps.length,
  sweepTotalSol: (sweeps.reduce((a, s) => a + Number(s.sol_lamports), 0) / 1e9).toFixed(4),
  sweepTotalZec: z8(sweeps.reduce((a, s) => a + Number(s.zec_raw), 0)),
  floor: state.floorZec.toFixed(8),
  holdPool: (state.holdPendingZec + state.holdOwedZec).toFixed(8),
  inFlight: state.payoutOwedZec.toFixed(8),
  ledger: state.ledgerTotalZec.toFixed(8),
  onchain: state.intentsBalanceZec.toFixed(8),
  match: state.ledgerMatchesOnChain === true,
  mint: state.mint,
  treasury: sweepQuote.quoteResponse.quoteRequest.recipient,
  vault: sweepQuote.quoteResponse.quoteRequest.refundTo,
};
console.log(JSON.stringify(D, null, 2));

// ---------- drawing primitives (same look as brand/content cards) ----------
const W = 1600, H = 900;
const FONT = {
  fontFiles: ['C:/Windows/Fonts/seguibl.ttf', 'C:/Windows/Fonts/segoeuib.ttf', 'C:/Windows/Fonts/segoeui.ttf', 'C:/Windows/Fonts/consola.ttf', 'C:/Windows/Fonts/consolab.ttf'],
  loadSystemFonts: false,
  defaultFontFamily: 'Segoe UI',
};
const C = { bg: '#08080b', panel: '#111117', line: '#34343f', ink: '#f2efe6', ink2: '#a4a4b4', ink3: '#6b6b7c', gold: '#f4b728', gold2: '#ffe08a', green: '#3ee38a', blue: '#6ea8fe', red: '#ff6b61', purple: '#c98bff' };
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const ZPATH = 'M128 106 H272 V136 L172 244 H272 V274 H128 V244 L228 136 H128 Z';
const T = (x, y, size, parts, opt = {}) => {
  const spans = (Array.isArray(parts) ? parts : [[parts, opt.color ?? C.ink]]).map(([t, c]) => `<tspan fill="${c}">${esc(t)}</tspan>`).join('');
  return `<text x="${x}" y="${y}" font-family="${opt.mono ? 'Consolas' : 'Segoe UI'}" font-weight="${opt.weight ?? 900}" font-size="${size}" letter-spacing="${opt.ls ?? (opt.mono ? 1 : size > 48 ? -1.5 : 0)}" text-anchor="${opt.anchor ?? 'start'}"${opt.glow ? ' filter="url(#softglow)"' : ''}>${spans}</text>`;
};
const box = (x, y, w, h, stroke = C.line, fill = C.panel, sw = 2, rx = 18) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
const arrowDown = (x, y1, y2, color = C.gold) => `<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" stroke="${color}" stroke-width="4" marker-end="url(#arr-${color.slice(1)})"/>`;
const shield = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})"><path d="M13 0 L25 5 V13 C25 21 19.5 26 13 28 C6.5 26 1 21 1 13 V5 Z" fill="${C.gold}" fill-opacity="0.2" stroke="${C.gold}" stroke-width="2.4" stroke-linejoin="round"/><path d="M8 14 L12 18 L19 10" fill="none" stroke="${C.gold2}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></g>`;
const logo = (cx, cy, s) => `<g transform="translate(${cx} ${cy}) scale(${s}) translate(-200 -200)"><circle cx="200" cy="200" r="168" fill="#0d0c0e" stroke="url(#ring)" stroke-width="9"/><path d="${ZPATH}" fill="url(#gold)"/><rect x="104" y="294" width="192" height="12" rx="6" fill="#ffe9a8" filter="url(#glow)"/></g>`;
const stamp = (x, y, text, color = C.green) => `<g transform="rotate(-6 ${x} ${y})"><rect x="${x - 105}" y="${y - 30}" width="210" height="56" rx="10" fill="${color}" fill-opacity="0.10" stroke="${color}" stroke-width="4"/>${T(x, y + 10, 28, text, { anchor: "middle", color, ls: 3 })}</g>`;
const arrowDefs = [C.gold, C.green, C.blue, C.red, C.purple, C.ink2].map((c) => `<marker id="arr-${c.slice(1)}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 L10 5 L0 10 z" fill="${c}"/></marker>`).join('');
const DEFS = `<defs>
  <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse"><path d="M50 0 H0 V50" fill="none" stroke="#fff" stroke-opacity="0.045"/></pattern>
  <radialGradient id="g1" cx="85%" cy="0%" r="70%"><stop offset="0" stop-color="${C.gold}" stop-opacity="0.18"/><stop offset="1" stop-color="${C.gold}" stop-opacity="0"/></radialGradient>
  <radialGradient id="g2" cx="0%" cy="100%" r="60%"><stop offset="0" stop-color="${C.blue}" stop-opacity="0.10"/><stop offset="1" stop-color="${C.blue}" stop-opacity="0"/></radialGradient>
  <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe08a"/><stop offset="0.5" stop-color="#f4b728"/><stop offset="1" stop-color="#c98a10"/></linearGradient>
  <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffd76a"/><stop offset="0.5" stop-color="#b8860b"/><stop offset="1" stop-color="#ffd76a"/></linearGradient>
  <filter id="glow" x="-50%" y="-300%" width="200%" height="700%"><feGaussianBlur stdDeviation="8" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <filter id="softglow" x="-10%" y="-40%" width="120%" height="180%"><feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  ${arrowDefs}
</defs>`;

const N = 5;
function card(i, { eyebrow, title, body = [], art, eyebrowColor = C.green }) {
  let s = `<rect width="${W}" height="${H}" fill="${C.bg}"/><rect width="${W}" height="${H}" fill="url(#grid)"/><rect width="${W}" height="${H}" fill="url(#g1)"/><rect width="${W}" height="${H}" fill="url(#g2)"/>`;
  s += logo(98, 96, 0.19) + T(140, 106, 30, [['ZEARN', C.ink]], { weight: 900, ls: 1 });
  s += `<rect x="${W - 410}" y="72" width="330" height="46" rx="23" fill="${C.green}" fill-opacity="0.10" stroke="${C.green}" stroke-width="2"/><circle cx="${W - 384}" cy="95" r="7" fill="${C.green}"/>`;
  s += T(W - 102, 104, 22, `ON-CHAIN PROOF ${i}/${N}`, { mono: true, anchor: 'end', color: C.green, weight: 700 });
  s += T(80, 240, 24, eyebrow.toUpperCase(), { mono: true, color: eyebrowColor, weight: 700, ls: 4 });
  title.forEach((parts, k) => (s += T(76, 330 + k * 84, 76, parts, { glow: k === title.length - 1 })));
  const by = 330 + title.length * 84 + 16;
  body.forEach((txt, k) => (s += T(80, by + k * 42, 28, [[txt, C.ink2]], { weight: 600, ls: 0 })));
  s += `<g>${art}</g>`;
  s += `<line x1="80" y1="${H - 110}" x2="${W - 80}" y2="${H - 110}" stroke="#fff" stroke-opacity="0.08"/>`;
  s += T(80, H - 60, 30, [['Receipts, ', C.ink], ['not promises.', C.gold]], { weight: 900 }) + shield(430, H - 86, 1.15);
  s += T(W - 80, H - 60, 24, '@zearnvault · $ZEARN', { mono: true, anchor: 'end', color: C.ink2, weight: 700 });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${DEFS}${s}</svg>`;
}
/** a stacked step box used in the flow cards: label, big value, small detail line */
const step = (y, h, color, label, value, detail) =>
  `${box(900, y, 640, h, color, C.panel, 2)}${T(930, y + 36, 20, label, { mono: true, color, weight: 700, ls: 2 })}${T(930, y + 84, 40, value)}${detail ? T(930, y + h - 18, 20, detail, { mono: true, color: C.ink3, weight: 700, ls: 0 }) : ''}`;

const CARDS = [
  // 1. the first sweep: creator fees -> NEAR Intents -> ZEC
  () => card(1, {
    eyebrow: 'Sweep #1 · settled',
    title: [[['Creator fees', C.ink]], [['became Zcash.', C.gold]]],
    body: [`${D.sweepSol} SOL of pump.fun creator fees swapped`, `to ${D.sweepZec} ZEC through NEAR Intents`, `1Click in ${D.sweepSecs} seconds. No bridge UI, no CEX.`, `Split 50/50: Floor Vault and Hold Pool.`, `${D.sweepCount} sweeps so far: ${D.sweepTotalZec} ZEC stacked.`],
    art: `${step(150, 150, C.purple, 'SOLANA · CREATOR FEES IN', `${D.sweepSol} SOL`, `${D.sweepSolUsd} · tx ${sh(D.sweepTx, 6)}`)}
      ${arrowDown(1220, 306, 344, C.blue)}
      ${step(350, 150, C.blue, 'NEAR INTENTS · 1CLICK SWAP', `${D.sweepSecs} seconds`, `intent ${sh(D.sweepIntent, 6)}`)}
      ${arrowDown(1220, 506, 544, C.gold)}
      ${step(550, 150, C.gold, 'ZEC TREASURY · intents.near', `${D.sweepZec} ZEC`, `${D.sweepZecUsd} · floor ${D.sweepFloor} · hold ${D.sweepHold}`)}
      ${stamp(1430, 245, 'SUCCESS')}`,
  }),
  // 2. the first redeem: burn -> pro-rata ZEC -> SOL delivered
  () => card(2, {
    eyebrow: 'Redeem #1 · round trip',
    title: [[['Burn in.', C.ink]], [['SOL out.', C.gold]]],
    body: [`First redeem (a team test burn): ${D.burnTokens}`, `$ZEARN burned, the vault paid its exact`, `pro-rata ZEC share, delivered as SOL.`, `The 2% fee stayed in the vault for holders.`],
    art: `${step(150, 150, C.red, 'SOLANA · BURN + MEMO', `${D.burnTokens} ZEARN`, `tx ${sh(D.burnTx, 6)}`)}
      ${arrowDown(1220, 306, 344, C.gold)}
      ${step(350, 150, C.gold, 'FLOOR VAULT · PRO-RATA SHARE', `${D.burnPayout} ZEC`, `gross ${D.burnGross} · 2% fee ${D.burnFee} stays`)}
      ${arrowDown(1220, 506, 544, C.green)}
      ${step(550, 150, C.green, 'DELIVERED · VIA NEAR INTENTS', `${D.paySol} SOL`, `${D.payUsd} · tx ${sh(D.payTx, 6)}`)}
      ${stamp(1430, 245, 'PAID')}`,
  }),
  // 3. hold pool, cumulative over all funded epochs
  () => card(3, {
    eyebrow: `Hold Pool · ${D.accEpochs} epoch${D.accEpochs === 1 ? '' : 's'} funded`,
    title: [[['Holding already', C.ink]], [['earns ZEC.', C.green]]],
    body: [`${D.accNet} ZEC accrued to ${D.accHolders} holders,`, `pro-rata to balance: no staking, no burn.`, `Early sellers forfeited ${D.accForfeit} ZEC,`, `recycled into the next epoch for the rest.`],
    art: (() => {
      const total = Number(D.accIn);
      const kept = Number(D.accNet);
      const wK = Math.round(560 * (kept / total));
      return `${box(900, 150, 640, 560)}
        ${T(1220, 330, 190, String(D.accHolders), { anchor: 'middle', color: C.green, glow: true })}
        ${T(1220, 390, 26, 'HOLDERS ACCRUING ZEC', { mono: true, anchor: 'middle', color: C.ink2, ls: 4 })}
        ${T(940, 480, 22, 'HOLD POOL FLOWS SO FAR', { mono: true, color: C.gold, weight: 700 })}${T(1500, 480, 26, `${D.accIn} ZEC`, { mono: true, anchor: 'end' })}
        <rect x="940" y="505" width="560" height="44" rx="10" fill="#1b1b24"/><rect x="940" y="505" width="${wK}" height="44" rx="10" fill="${C.green}" fill-opacity="0.85"/><rect x="${940 + wK}" y="505" width="${560 - wK}" height="44" rx="10" fill="${C.red}" fill-opacity="0.75"/>
        ${T(940, 590, 22, [['■ ', C.green], ['kept by holders ', C.ink2]], { weight: 700 })}${T(1500, 590, 22, `${kept.toFixed(8)} ZEC`, { mono: true, anchor: 'end', color: C.green })}
        ${T(940, 630, 22, [['■ ', C.red], ['forfeited by sellers, recycled', C.ink2]], { weight: 700 })}${T(1500, 630, 22, `${D.accForfeit} ZEC`, { mono: true, anchor: 'end', color: C.red })}
        ${T(940, 680, 20, 'Unlock: 15 min 5% … 8 h 100% · LIFO lots', { mono: true, color: C.ink3, weight: 700 })}`;
    })(),
  }),
  // 4. ledger = chain
  () => card(4, {
    eyebrow: 'Live ledger check',
    title: [[['Our books', C.ink]], [['= the chain.', C.gold]]],
    body: ['Every ZEC the vault owes is on-chain in', 'one NEAR Intents account. The site compares', 'ledger vs. intents.near balance every refresh.', 'Not a screenshot of a spreadsheet.'],
    art: `${box(900, 150, 640, 560)}
      ${T(940, 210, 22, 'LEDGER vs ON-CHAIN · LIVE', { mono: true, color: C.gold })}
      ${[['Floor Vault', D.floor, C.gold], ['Hold Pool', D.holdPool, C.green], ['Payouts in flight', D.inFlight, C.ink2]].map(([k, v, c], n) => `${T(940, 280 + n * 56, 28, [[k, C.ink2]], { weight: 700 })}${T(1500, 280 + n * 56, 28, [[v, c]], { mono: true, anchor: 'end' })}`).join('')}
      <line x1="940" y1="432" x2="1500" y2="432" stroke="${C.line}" stroke-width="2"/>
      ${T(940, 482, 28, [['Ledger total', C.ink]], { weight: 900 })}${T(1500, 482, 28, [[D.ledger, C.ink]], { mono: true, anchor: 'end' })}
      ${T(940, 536, 28, [['On-chain (intents.near)', C.ink]], { weight: 900 })}${T(1500, 536, 28, [[D.onchain, C.ink]], { mono: true, anchor: 'end' })}
      <rect x="940" y="580" width="560" height="90" rx="14" fill="${D.match ? C.green : C.red}" fill-opacity="0.12" stroke="${D.match ? C.green : C.red}" stroke-width="2"/>${T(1220, 638, 34, D.match ? 'MATCH · 0 DRIFT' : 'MISMATCH', { anchor: 'middle', color: D.match ? C.green : C.red, ls: 3 })}`,
  }),
  // 5. verify yourself
  () => card(5, {
    eyebrow: 'Verify, don\u2019t trust',
    title: [[['Check every', C.ink]], [['receipt yourself.', C.gold]]],
    body: ['Every address and every swap is public.', 'Links in the thread below.'],
    art: `${box(900, 150, 640, 560)}
      ${[
        ['$ZEARN TOKEN (pump.fun)', sh(D.mint, 8), C.purple],
        ['CREATOR-FEE VAULT (Solana)', sh(D.vault, 8), C.purple],
        ['ZEC TREASURY (intents.near)', sh(D.treasury, 8), C.blue],
        ['SWAP RECEIPTS', 'explorer.near-intents.org', C.blue],
        ['LIVE LEDGER', 'zearn site · #/ledger', C.gold],
      ].map(([k, v, c], n) => `${T(940, 215 + n * 104, 20, k, { mono: true, color: c, weight: 700, ls: 2 })}${T(940, 255 + n * 104, 32, v, { mono: true, weight: 700, ls: 0 })}${n < 4 ? `<line x1="940" y1="${280 + n * 104}" x2="1500" y2="${280 + n * 104}" stroke="#fff" stroke-opacity="0.06"/>` : ''}`).join('')}`,
  }),
];

CARDS.forEach((fn, k) => {
  const png = new Resvg(fn(), { font: FONT, fitTo: { mode: 'width', value: W } }).render().asPng();
  writeFileSync(`${OUT}/proof-${k + 1}.png`, png);
  console.log(`proof-${k + 1}.png ${(png.length / 1024).toFixed(0)} KB`);
});
writeFileSync(`${OUT}/proof-data.json`, JSON.stringify({ generatedAt: new Date().toISOString(), ...D }, null, 2));
