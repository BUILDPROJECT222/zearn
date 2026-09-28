// Requires: npm i @resvg/resvg-js@2 (run from a folder where it is installed) and ffmpeg on PATH. Windows fonts: Segoe UI, Consolas.
// Zearn mechanism explainer: 1080x1080, 30 fps, ~46 s. Every frame is an SVG rendered with resvg, piped into ffmpeg.
// Usage: node video.mjs            -> full MP4
//        node video.mjs keyframes  -> a contact sheet of key moments for review
import { Resvg } from '@resvg/resvg-js';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const OUT = 'E:/project/near/brand/video';
mkdirSync(OUT, { recursive: true });
const W = 1080, H = 1080, FPS = 30;
const FONT = {
  fontFiles: ['C:/Windows/Fonts/seguibl.ttf', 'C:/Windows/Fonts/segoeuib.ttf', 'C:/Windows/Fonts/segoeui.ttf', 'C:/Windows/Fonts/consola.ttf', 'C:/Windows/Fonts/consolab.ttf'],
  loadSystemFonts: false,
  defaultFontFamily: 'Segoe UI',
};

// ---------- palette ----------
const C = { bg: '#08080b', panel: '#111117', line: '#34343f', ink: '#f2efe6', ink2: '#a4a4b4', ink3: '#6b6b7c', gold: '#f4b728', gold2: '#ffe08a', green: '#3ee38a', blue: '#6ea8fe', red: '#ff6b61', purple: '#c98bff' };

// ---------- math ----------
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const seg = (t, a, b) => clamp((t - a) / (b - a));
const eOut = (t) => 1 - Math.pow(1 - t, 3);
const eInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const eBack = (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
const eBounce = (x) => {
  const n = 7.5625, d = 2.75;
  if (x < 1 / d) return n * x * x;
  if (x < 2 / d) return n * (x -= 1.5 / d) * x + 0.75;
  if (x < 2.5 / d) return n * (x -= 2.25 / d) * x + 0.9375;
  return n * (x -= 2.625 / d) * x + 0.984375;
};
const f = (n, d = 1) => n.toFixed(d);

// ---------- primitives ----------
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** text line made of [text, color] parts, centered unless x/anchor given; slides up + fades in from t0 */
function line(parts, y, size, lt, t0, opt = {}) {
  const p = eOut(seg(lt, t0, t0 + 0.45));
  if (p <= 0) return '';
  const x = opt.x ?? 540, anchor = opt.anchor ?? 'middle', weight = opt.weight ?? 900, fam = opt.family ?? 'Segoe UI';
  const spans = parts.map(([t, c]) => `<tspan fill="${c}">${esc(t)}</tspan>`).join('');
  const glow = opt.glow ? ' filter="url(#softglow)"' : '';
  return `<text x="${x}" y="${f(y + (1 - p) * 26)}" font-family="${fam}" font-weight="${weight}" font-size="${size}" letter-spacing="${opt.ls ?? (size > 50 ? -1.5 : 0)}" text-anchor="${anchor}" opacity="${f(p, 3)}"${glow}>${spans}</text>`;
}
const coin = (x, y, r, color, label, op = 1) =>
  `<g opacity="${f(op, 3)}"><circle cx="${f(x)}" cy="${f(y)}" r="${r}" fill="${color}" stroke="#000" stroke-opacity="0.5" stroke-width="2"/><circle cx="${f(x - r * 0.3)}" cy="${f(y - r * 0.3)}" r="${f(r * 0.28)}" fill="#fff" opacity="0.35"/><text x="${f(x)}" y="${f(y + r * 0.36)}" font-family="Segoe UI" font-weight="900" font-size="${f(r * 1.05)}" text-anchor="middle" fill="#0a0a0e">${label}</text></g>`;
const ZPATH = 'M128 106 H272 V136 L172 244 H272 V274 H128 V244 L228 136 H128 Z';
const shield = (x, y, s = 1) =>
  `<g transform="translate(${f(x)} ${f(y)}) scale(${s})"><path d="M13 0 L25 5 V13 C25 21 19.5 26 13 28 C6.5 26 1 21 1 13 V5 Z" fill="${C.gold}" fill-opacity="0.2" stroke="${C.gold}" stroke-width="2.4" stroke-linejoin="round"/><path d="M8 14 L12 18 L19 10" fill="none" stroke="${C.gold2}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></g>`;
const box = (x, y, w, h, stroke = C.line, fill = C.panel, sw = 2, rx = 18) => `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
const mono = (t, x, y, size, color, anchor = 'middle', op = 1) => `<text x="${f(x)}" y="${f(y)}" font-family="Consolas" font-weight="700" font-size="${size}" letter-spacing="2" text-anchor="${anchor}" fill="${color}" opacity="${f(op, 3)}">${esc(t)}</text>`;

const DEFS = `<defs>
  <pattern id="grid" width="54" height="54" patternUnits="userSpaceOnUse"><path d="M54 0 H0 V54" fill="none" stroke="#fff" stroke-opacity="0.045"/></pattern>
  <radialGradient id="g1" cx="80%" cy="0%" r="75%"><stop offset="0" stop-color="${C.gold}" stop-opacity="0.18"/><stop offset="1" stop-color="${C.gold}" stop-opacity="0"/></radialGradient>
  <radialGradient id="g2" cx="0%" cy="100%" r="70%"><stop offset="0" stop-color="${C.blue}" stop-opacity="0.10"/><stop offset="1" stop-color="${C.blue}" stop-opacity="0"/></radialGradient>
  <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe08a"/><stop offset="0.5" stop-color="#f4b728"/><stop offset="1" stop-color="#c98a10"/></linearGradient>
  <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffd76a"/><stop offset="0.5" stop-color="#b8860b"/><stop offset="1" stop-color="#ffd76a"/></linearGradient>
  <linearGradient id="redfade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.red}" stop-opacity="0.35"/><stop offset="1" stop-color="${C.red}" stop-opacity="0"/></linearGradient>
  <filter id="glow" x="-50%" y="-300%" width="200%" height="700%"><feGaussianBlur stdDeviation="9" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <filter id="softglow" x="-10%" y="-40%" width="120%" height="180%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
</defs>`;
const BG = `<rect width="${W}" height="${H}" fill="${C.bg}"/><rect width="${W}" height="${H}" fill="url(#grid)"/><rect width="${W}" height="${H}" fill="url(#g1)"/><rect width="${W}" height="${H}" fill="url(#g2)"/>`;

// ---------- scenes: (lt, d) -> svg ----------
const S = [];

// 1. hook: most memecoins go to zero
S.push({ d: 4.5, draw(lt) {
  let o = line([['Most memecoins', C.ink]], 215, 80, lt, 0.1) + line([['go to zero.', C.red]], 305, 80, lt, 0.5);
  const X0 = 150, X1 = 930;
  const yAt = (u) => {
    const base = u < 0.22 ? lerp(560, 440, u / 0.22) : u < 0.9 ? lerp(440, 845, Math.pow((u - 0.22) / 0.68, 1.6)) : 848;
    return base + (18 * Math.sin(u * 41) + 10 * Math.sin(u * 97)) * (1 - u);
  };
  const p = eInOut(seg(lt, 0.55, 3.0));
  o += `<line x1="${X0}" y1="850" x2="${X1}" y2="850" stroke="${C.red}" stroke-opacity="0.5" stroke-width="2" stroke-dasharray="10 10"/>`;
  o += mono('$0', X1 + 10, 858, 24, C.red, 'start', seg(lt, 0.6, 1));
  if (p > 0) {
    const n = Math.max(2, Math.round(140 * p));
    const pts = Array.from({ length: n }, (_, i) => { const u = (i / (n - 1)) * p; return `${f(lerp(X0, X1, u))},${f(yAt(u))}`; });
    const last = pts[pts.length - 1].split(',');
    o += `<polygon points="${X0},850 ${pts.join(' ')} ${last[0]},850" fill="url(#redfade)"/>`;
    o += `<polyline points="${pts.join(' ')}" fill="none" stroke="${C.red}" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"/>`;
    o += `<circle cx="${last[0]}" cy="${last[1]}" r="10" fill="${C.red}"/>`;
  }
  const b = eBack(seg(lt, 3.0, 3.4));
  if (b > 0) o += `<g transform="translate(820 470) scale(${f(b, 3)})">${box(-110, -44, 220, 88, C.red, '#2a1113', 3, 16)}<text x="0" y="17" font-family="Segoe UI" font-weight="900" font-size="46" text-anchor="middle" fill="${C.red}">-99.9%</text></g>`;
  return o;
} });

// 2. $ZEARN has a floor: the Z drops onto a glowing floor
S.push({ d: 4.6, draw(lt) {
  let o = '';
  const fw = eOut(seg(lt, 0.0, 0.5));
  const flash = 1 + 1.6 * Math.max(0, 1 - Math.abs(lt - 1.35) / 0.35);
  o += `<rect x="${f(540 - 260 * fw)}" y="700" width="${f(520 * fw)}" height="20" rx="10" fill="${C.gold2}" filter="url(#glow)" opacity="${f(clamp(0.7 * flash, 0, 1), 3)}"/>`;
  o += `<rect x="${f(540 - 260 * fw)}" y="700" width="${f(520 * fw)}" height="20" rx="10" fill="#ffe9a8"/>`;
  const drop = eBounce(seg(lt, 0.35, 1.45));
  const ty = lerp(-700, 169, drop);
  if (lt > 0.35) o += `<g transform="translate(160 ${f(ty)}) scale(1.9)"><path d="${ZPATH}" fill="url(#gold)"/></g>`;
  // dust puffs on impact
  const dp = seg(lt, 1.3, 2.1);
  if (dp > 0 && dp < 1) for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI - Math.PI, r = 40 + 190 * eOut(dp);
    o += `<circle cx="${f(540 + Math.cos(a) * r * 1.4)}" cy="${f(700 + Math.sin(a) * r * 0.25)}" r="${f(7 * (1 - dp))}" fill="${C.gold2}" opacity="${f(1 - dp, 3)}"/>`;
  }
  o += line([['$ZEARN ', C.ink], ['has a floor.', C.gold]], 200, 82, lt, 1.65, { glow: true });
  o += line([['Backed by ZEC in a public vault.', C.ink2]], 810, 36, lt, 2.3, { weight: 700 });
  return o;
} });

// 3. every trade pays a creator fee
S.push({ d: 6.2, draw(lt) {
  let o = line([['Every trade pays', C.ink]], 160, 70, lt, 0.1) + line([['a creator fee.', C.gold]], 245, 70, lt, 0.4);
  // pump.fun terminal with live candles
  o += box(80, 380, 360, 330) + mono('PUMP.FUN', 260, 750, 26, C.ink2);
  for (let i = 0; i < 9; i++) {
    const h = 50 + 110 * Math.abs(Math.sin(i * 1.7 + lt * 2.6 + i * i * 0.3));
    const up = Math.sin(i * 2.1 + lt * 3) > -0.2;
    o += `<rect x="${108 + i * 36}" y="${f(660 - h)}" width="22" height="${f(h)}" rx="3" fill="${up ? C.green : C.red}"/>`;
    o += `<rect x="${118 + i * 36}" y="${f(640 - h)}" width="2" height="${f(h + 40)}" fill="${up ? C.green : C.red}" opacity="0.6"/>`;
  }
  // vault wallet
  const sweep = eInOut(seg(lt, 4.9, 5.8));
  o += box(640, 430, 360, 230, C.gold, '#15130c', 3) + mono('VAULT WALLET', 820, 700, 26, C.gold);
  // coins in flight and landed
  let landed = 0;
  for (let k = 0; k < 11; k++) {
    const s = 0.7 + k * 0.33, p = seg(lt, s, s + 0.8);
    if (p <= 0) continue;
    if (p >= 1) { landed++; continue; }
    const e = eInOut(p);
    const x = lerp(440, 800 + (k % 5) * 12, e), y = lerp(520, 560, e) - Math.sin(e * Math.PI) * 170;
    o += coin(x, y, 22, C.blue, 'S');
  }
  for (let i = 0; i < landed; i++) {
    const cx = 690 + (i % 6) * 50 + sweep * 520, cy = 610 - Math.floor(i / 6) * 50;
    o += coin(cx, cy, 20, C.blue, 'S', 1 - sweep);
  }
  o += mono(`fees: ${f(landed * 0.012, 3)} SOL`, 820, 475, 24, C.ink, 'middle', seg(lt, 0.8, 1.1) * (1 - sweep));
  o += line([['0.30% – 0.95% of every buy and sell', C.ink2]], 815, 32, lt, 1.2, { weight: 700 });
  o += line([['A keeper sweeps it every 5 minutes →', C.gold]], 880, 34, lt, 4.5, { weight: 800 });
  return o;
} });

// 4. fees become ZEC via NEAR Intents
S.push({ d: 6.2, draw(lt) {
  let o = line([['Fees become ', C.ink], ['ZEC', C.gold]], 160, 74, lt, 0.1) + line([['via NEAR Intents', C.blue]], 245, 62, lt, 0.4);
  // portal
  const pulse = 1 + 0.06 * Math.sin(lt * 6);
  o += `<g transform="translate(540 600) scale(${f(pulse, 3)})"><path d="M-95 110 V-10 A95 95 0 0 1 95 -10 V110" fill="none" stroke="${C.blue}" stroke-width="16"/><path d="M-72 110 V-6 A72 72 0 0 1 72 -6 V110" fill="#0a0a0e" stroke="${C.line}" stroke-width="2"/></g>`;
  o += mono('NEAR INTENTS', 540, 760, 26, C.blue);
  // vault
  let inVault = 0;
  const flights = [];
  for (let k = 0; k < 9; k++) {
    const s = 0.5 + k * 0.4;
    const a = seg(lt, s, s + 0.9), b = seg(lt, s + 0.9, s + 1.7);
    if (a <= 0) continue;
    if (b >= 1) { inVault++; continue; }
    if (a < 1) flights.push(coin(lerp(-40, 540, eInOut(a)), 640 - Math.sin(a * Math.PI) * 30, 24, C.blue, 'S'));
    else {
      const e = eInOut(b);
      flights.push(coin(lerp(540, 890, e), lerp(640, 520, e) - Math.sin(e * Math.PI) * 120, 24, C.gold, 'Z'));
      if (b < 0.15) flights.push(`<circle cx="540" cy="640" r="${f(40 * (1 - b / 0.15))}" fill="#fff" opacity="${f(0.8 * (1 - b / 0.15), 3)}"/>`);
    }
  }
  const lvl = clamp(inVault / 9);
  o += box(800, 520, 180, 230, C.gold, '#15130c', 3);
  o += `<rect x="812" y="${f(738 - 206 * lvl)}" width="156" height="${f(206 * lvl)}" rx="10" fill="url(#gold)" opacity="0.9"/>`;
  o += mono('ZEC VAULT', 890, 790, 24, C.gold);
  o += flights.join('');
  o += line([['Public balance. Anyone can check it.', C.ink2]], 880, 34, lt, 4.2, { weight: 700 });
  return o;
} });

// 5. the split: floor and hold pool
S.push({ d: 5.4, draw(lt) {
  let o = line([['Half becomes the ', C.ink], ['floor.', C.gold]], 155, 62, lt, 0.1) + line([['Half pays the ', C.ink], ['holders.', C.green]], 235, 62, lt, 0.5);
  const drain = eInOut(seg(lt, 1.0, 3.4));
  o += box(440, 320, 200, 200, C.gold, '#15130c', 3);
  o += `<rect x="452" y="${f(508 - 176 * (1 - drain) * 0.95)}" width="176" height="${f(176 * (1 - drain) * 0.95)}" rx="10" fill="url(#gold)"/>`;
  o += mono('ZEC VAULT', 540, 555, 22, C.gold);
  // streams
  if (drain > 0 && drain < 1) {
    o += `<path d="M470 520 C 420 580, 330 590, 310 650" fill="none" stroke="${C.gold}" stroke-width="12" stroke-linecap="round" opacity="0.9"/>`;
    o += `<path d="M610 520 C 660 580, 750 590, 770 650" fill="none" stroke="${C.green}" stroke-width="12" stroke-linecap="round" opacity="0.9"/>`;
  }
  const tank = (x, color, fillId, label, sub, t0) => {
    const lvl = drain;
    let g = box(x, 650, 260, 230, color, C.panel, 3);
    g += `<rect x="${x + 12}" y="${f(868 - 206 * lvl * 0.9)}" width="236" height="${f(206 * lvl * 0.9)}" rx="10" fill="${fillId}" opacity="0.85"/>`;
    g += `<text x="${x + 130}" y="770" font-family="Segoe UI" font-weight="900" font-size="40" text-anchor="middle" fill="#fff" opacity="${f(seg(lt, t0, t0 + 0.4), 3)}">${label}</text>`;
    g += mono(sub, x + 130, 930, 24, color, 'middle', seg(lt, t0 + 0.4, t0 + 0.8));
    return g;
  };
  o += tank(180, C.gold, 'url(#gold)', 'FLOOR 50%', 'burn → take ZEC', 1.6);
  o += tank(640, C.green, C.green, 'HOLD 50%', 'hold → unlock ZEC', 1.9);
  return o;
} });

// 6. hold to unlock + paper hands pay diamond hands
S.push({ d: 8.4, draw(lt) {
  let o = '';
  const A = 1 - seg(lt, 3.7, 4.1);
  if (A > 0) {
    let a = line([['Hold to ', C.ink], ['unlock.', C.gold]], 170, 80, lt, 0.1) + line([['The longer you hold, the more you claim.', C.ink2]], 245, 34, lt, 0.4, { weight: 700 });
    const ticks = [[0.12, '15m', 5], [0.36, '1h', 20], [0.66, '4h', 60], [1.0, '8h', 100]];
    const p = eInOut(seg(lt, 0.7, 3.3));
    const X0 = 150, X1 = 930;
    a += `<rect x="${X0}" y="520" width="${X1 - X0}" height="28" rx="14" fill="${C.panel}" stroke="${C.line}" stroke-width="2"/>`;
    a += `<rect x="${X0}" y="520" width="${f((X1 - X0) * p)}" height="28" rx="14" fill="url(#gold)"/>`;
    let pct = 0, held = '0m';
    let prev = [0, '0m', 0];
    for (const t of ticks) {
      const x = lerp(X0, X1, t[0]);
      a += `<line x1="${f(x)}" y1="505" x2="${f(x)}" y2="562" stroke="${p >= t[0] ? C.gold2 : C.line}" stroke-width="3"/>`;
      a += mono(t[1], x, 600, 26, p >= t[0] ? C.ink : C.ink3) + mono(`${t[2]}%`, x, 490, 26, p >= t[0] ? C.gold : C.ink3);
      if (p >= t[0]) { pct = t[2]; held = t[1]; prev = t; }
      else if (p > prev[0]) { pct = Math.round(lerp(prev[2], t[2], (p - prev[0]) / (t[0] - prev[0]))); break; }
    }
    a += `<text x="540" y="780" font-family="Segoe UI" font-weight="900" font-size="140" text-anchor="middle" fill="url(#gold)" filter="url(#softglow)">${pct}%</text>`;
    a += mono(`unlocked · held ${held}`, 540, 835, 28, C.ink2);
    o += `<g opacity="${f(A, 3)}">${a}</g>`;
  }
  const B = seg(lt, 4.0, 4.4);
  if (B > 0) {
    const bt = lt - 4.0;
    let b = line([['Sell early?', C.ink]], 150, 64, bt, 0.0) + line([['Your locked ZEC goes to', C.ink]], 225, 50, bt, 0.25) + line([['the diamond hands.', C.gold]], 290, 50, bt, 0.45, { glow: true });
    // paper hands card
    const sold = seg(bt, 0.8, 1.1);
    b += box(90, 380, 400, 420, sold > 0 ? C.red : C.line);
    b += `<g transform="translate(250 430)"><path d="M0 0 H60 L80 20 V100 H0 Z" fill="#e8e4d8" opacity="0.9"/><path d="M60 0 V20 H80" fill="#bdb8aa"/><line x1="12" y1="40" x2="66" y2="40" stroke="#999" stroke-width="4"/><line x1="12" y1="60" x2="66" y2="60" stroke="#999" stroke-width="4"/></g>`;
    b += `<text x="290" y="600" font-family="Segoe UI" font-weight="900" font-size="36" text-anchor="middle" fill="${C.ink}">PAPER HANDS</text>`;
    b += mono('sold after 1 h', 290, 640, 24, C.ink2);
    const flow = eInOut(seg(bt, 1.3, 3.2));
    b += `<rect x="130" y="680" width="320" height="26" rx="13" fill="${C.panel}" stroke="${C.line}" stroke-width="2"/>`;
    b += `<rect x="130" y="680" width="64" height="26" rx="13" fill="${C.green}"/>`;
    b += `<rect x="194" y="680" width="${f(256 * (1 - flow))}" height="26" rx="6" fill="${C.gold}" opacity="0.85"/>`;
    b += mono(flow < 1 ? '20% kept · 80% locked' : '20% kept · 80% forfeited', 290, 750, 22, flow < 1 ? C.ink2 : C.red);
    if (sold > 0) b += `<g transform="translate(290 520) rotate(-12) scale(${f(eBack(sold), 3)})"><rect x="-90" y="-34" width="180" height="68" rx="8" fill="none" stroke="${C.red}" stroke-width="5"/><text x="0" y="16" font-family="Segoe UI" font-weight="900" font-size="44" text-anchor="middle" fill="${C.red}">SOLD</text></g>`;
    // diamond hands card
    b += box(590, 380, 400, 420, C.gold, '#15130c', 3);
    b += `<g transform="translate(790 470)"><polygon points="-46,-20 -22,-44 22,-44 46,-20 0,40" fill="${C.blue}" opacity="0.9"/><polygon points="-46,-20 46,-20 0,40" fill="#9cc4ff"/><polyline points="-22,-44 -12,-20 0,40 12,-20 22,-44" fill="none" stroke="#fff" stroke-opacity="0.6" stroke-width="2"/></g>`;
    b += `<text x="790" y="600" font-family="Segoe UI" font-weight="900" font-size="36" text-anchor="middle" fill="${C.gold}">DIAMOND HANDS</text>`;
    b += mono('held 8 h · 100% unlocked', 790, 640, 24, C.ink2);
    b += `<text x="790" y="730" font-family="Segoe UI" font-weight="900" font-size="54" text-anchor="middle" fill="${C.green}">+${Math.round(80 * flow)}%</text>`;
    b += mono('bonus from forfeits', 790, 770, 22, C.green, 'middle', seg(bt, 1.3, 1.6));
    for (let k = 0; k < 8; k++) {
      const p = seg(bt, 1.3 + k * 0.2, 1.3 + k * 0.2 + 0.9);
      if (p <= 0 || p >= 1) continue;
      const e = eInOut(p);
      b += coin(lerp(330, 900, e), lerp(693, 470, e) - Math.sin(e * Math.PI) * 160, 18, C.gold, 'Z');
    }
    o += `<g opacity="${f(B, 3)}">${b}</g>`;
  }
  return o;
} });

// 7. emergency exit: dump below the floor, bots burn, price bounces back
S.push({ d: 7.6, draw(lt) {
  const second = seg(lt, 3.6, 4.0);
  let o = '';
  if (second < 1) o += `<g opacity="${f(1 - second, 3)}">${line([['Price dumps', C.ink]], 160, 72, lt, 0.1)}${line([['below the floor?', C.red]], 245, 72, lt, 0.4)}</g>`;
  if (second > 0) {
    const bt = lt - 3.6;
    o += line([['Burn → take your ZEC.', C.gold]], 160, 64, bt, 0.1, { glow: true }) + line([['Arb bots buy it back up.', C.ink]], 240, 56, bt, 0.4);
  }
  const X0 = 110, X1 = 960, FLOOR = 700;
  // glow as a rect (a filter on a zero-height line has an empty region and would hide it)
  o += `<rect x="${X0}" y="${FLOOR - 3}" width="${X1 - X0}" height="6" rx="3" fill="${C.gold}" opacity="0.55" filter="url(#glow)"/>`;
  o += `<line x1="${X0}" y1="${FLOOR}" x2="${X1}" y2="${FLOOR}" stroke="${C.gold2}" stroke-width="4" stroke-dasharray="14 10"/>`;
  o += mono('ZEC FLOOR', X0, FLOOR + 36, 22, C.gold, 'start');
  const yAt = (u) => {
    if (u < 0.45) return lerp(430, 815, Math.pow(u / 0.45, 1.4)) + 16 * Math.sin(u * 50) * (1 - u);
    if (u < 0.62) return 815 + 6 * Math.sin(u * 80);
    if (u < 0.8) return lerp(815, FLOOR - 12, eOut((u - 0.62) / 0.18));
    return FLOOR - 12 - 8 * Math.sin(u * 40);
  };
  const p = seg(lt, 0.3, 6.8);
  const n = Math.max(2, Math.round(160 * p));
  const pts = Array.from({ length: n }, (_, i) => { const u = (i / (n - 1)) * p; return [lerp(X0, X1, u), yAt(u)]; });
  const below = pts.filter(([, y]) => y > FLOOR + 4);
  if (below.length > 1) o += `<rect x="${f(below[0][0])}" y="${FLOOR}" width="${f(below[below.length - 1][0] - below[0][0])}" height="140" fill="${C.red}" opacity="${f(0.12 + 0.08 * Math.sin(lt * 10), 3)}"/>`;
  o += `<polyline points="${pts.map(([x, y]) => `${f(x)},${f(y)}`).join(' ')}" fill="none" stroke="${p > 0.62 ? C.green : C.red}" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"/>`;
  const last = pts[pts.length - 1];
  o += `<circle cx="${f(last[0])}" cy="${f(last[1])}" r="10" fill="${p > 0.62 ? C.green : C.red}"/>`;
  // bots
  const bots = seg(lt, 2.9, 3.3);
  if (bots > 0) for (let i = 0; i < 3; i++) {
    const bx = 470 + i * 90, by = 900 - Math.abs(Math.sin(lt * 7 + i)) * 12;
    o += `<g opacity="${f(bots, 3)}" transform="translate(${bx} ${f(by)})"><rect x="-26" y="-22" width="52" height="44" rx="10" fill="${C.panel}" stroke="${C.purple}" stroke-width="3"/><rect x="-14" y="-8" width="9" height="9" fill="${C.purple}"/><rect x="5" y="-8" width="9" height="9" fill="${C.purple}"/><rect x="-3" y="-36" width="6" height="14" fill="${C.purple}"/></g>`;
  }
  o += mono('ARB BOTS: BUY + BURN', 560, 965, 24, C.purple, 'middle', bots);
  return o;
} });

// 8. outro
S.push({ d: 5.2, draw(lt) {
  const s = eBack(seg(lt, 0.0, 0.7));
  let o = '';
  if (s > 0) o += `<g transform="translate(540 360) scale(${f(s, 3)}) translate(-200 -200)"><circle cx="200" cy="200" r="168" fill="#0d0c0e" stroke="url(#ring)" stroke-width="9"/><path d="${ZPATH}" fill="url(#gold)"/><rect x="104" y="294" width="192" height="12" rx="6" fill="#ffe9a8" filter="url(#glow)"/></g>`;
  o += line([['Hold to zearn.', C.ink]], 680, 80, lt, 0.6);
  o += line([['Never zero.', C.gold]], 770, 80, lt, 0.9, { glow: true });
  const sh = seg(lt, 1.1, 1.5);
  if (sh > 0) o += `<g opacity="${f(sh, 3)}">${shield(778, 712, 2.1 * eBack(sh))}</g>`;
  o += mono('$ZEARN · PUMP.FUN × NEAR INTENTS × ZCASH', 540, 860, 26, C.ink2, 'middle', seg(lt, 1.4, 1.8));
  o += mono('No APY. No promises. Not financial advice.', 540, 920, 20, C.ink3, 'middle', seg(lt, 1.8, 2.2));
  return o;
} });

// ---------- timeline ----------
const starts = [];
let acc = 0;
for (const s of S) { starts.push(acc); acc += s.d; }
const TOTAL = acc;

function frameSvg(t) {
  let i = S.length - 1;
  while (i > 0 && t < starts[i]) i--;
  const lt = t - starts[i], d = S[i].d;
  const fin = i === 0 ? 1 : seg(lt, 0, 0.3), fout = i === S.length - 1 ? 1 - seg(lt, d - 0.5, d) : 1 - seg(lt, d - 0.3, d);
  const body = S[i].draw(lt);
  const prog = t / TOTAL;
  const chrome = `<text x="60" y="78" font-family="Consolas" font-weight="700" font-size="24" letter-spacing="3" fill="${C.gold}">$ZEARN</text>` +
    `<rect x="60" y="1036" width="960" height="6" rx="3" fill="#fff" opacity="0.08"/><rect x="60" y="1036" width="${f(960 * prog)}" height="6" rx="3" fill="${C.gold}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${DEFS}${BG}<g opacity="${f(Math.min(fin, fout), 3)}">${body}</g>${chrome}</svg>`;
}
const render = (t, width = W) => new Resvg(frameSvg(t), { font: FONT, fitTo: { mode: 'width', value: width } }).render().asPng();

if (process.argv[2] === 'keyframes') {
  const ks = process.argv.slice(3).map(Number);
  const times = ks.length ? ks : [3.4, 6.7, 12.5, 17.8, 25.2, 29.0, 34.7, 38.2, 42.5, 47.5];
  times.forEach((t, i) => writeFileSync(`${OUT}/kf-${String(i).padStart(2, '0')}.png`, render(Math.min(t, TOTAL - 0.01), 540)));
  console.log(`total ${TOTAL.toFixed(1)} s, wrote ${times.length} keyframes`);
} else {
  const frames = Math.round(TOTAL * FPS);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', `${OUT}/zearn-explainer.mp4`], { stdio: ['pipe', 'inherit', 'inherit'] });
  const t0 = Date.now();
  for (let k = 0; k < frames; k++) {
    const png = render(k / FPS);
    if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once('drain', r));
    if (k % 150 === 0) console.log(`frame ${k}/${frames}  ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  writeFileSync(`${OUT}/zearn-explainer-poster.png`, render(TOTAL - 1.2));
  console.log(`done: ${frames} frames, ${TOTAL.toFixed(1)} s video in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}
