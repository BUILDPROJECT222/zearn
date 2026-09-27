import { config } from './config.js';
import { log } from './log.js';

const L = log('prices');
const UA = { 'user-agent': 'Mozilla/5.0 (compatible; ZearnKeeper/1.0)', accept: 'application/json' };
let cache: { at: number; sol: number; zec: number } | null = null;

/** SOL & ZEC prices (USD) from CoinGecko, cached 60s */
export async function getPrices(): Promise<{ sol: number; zec: number }> {
  if (cache && Date.now() - cache.at < 60_000) return cache;
  try {
    const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana,zcash&vs_currencies=usd', { headers: UA });
    const j = (await r.json()) as { solana?: { usd: number }; zcash?: { usd: number } };
    cache = { at: Date.now(), sol: j.solana?.usd ?? cache?.sol ?? 0, zec: j.zcash?.usd ?? cache?.zec ?? 0 };
  } catch (e) {
    L.warn('coingecko failed', (e as Error).message);
    if (!cache) cache = { at: Date.now(), sol: 0, zec: 0 };
  }
  return cache;
}

export type Market = { priceUsd: number; marketCapUsd: number; volume24h: number; dex: string; url: string } | null;
let mcache: { at: number; m: Market } | null = null;

async function fromDexScreener(): Promise<Market> {
  const r = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${config.mint}`, { headers: UA });
  const text = await r.text();
  if (!r.ok || text.trim().startsWith('<')) throw new Error(`dexscreener ${r.status} ${text.slice(0, 40)}`);
  const j = JSON.parse(text) as { pairs?: { priceUsd?: string; marketCap?: number; fdv?: number; volume?: { h24?: number }; dexId?: string; url?: string; liquidity?: { usd?: number } }[] };
  const p = (j.pairs ?? []).sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];
  return p ? { priceUsd: parseFloat(p.priceUsd ?? '0'), marketCapUsd: p.marketCap ?? p.fdv ?? 0, volume24h: p.volume?.h24 ?? 0, dex: p.dexId ?? '', url: p.url ?? '' } : null;
}

/** Jupiter price API: works from datacenter IPs; market cap = price × supply, no volume */
async function fromJupiter(supply: number): Promise<Market> {
  const r = await fetch(`https://lite-api.jup.ag/price/v3?ids=${config.mint}`, { headers: UA });
  const j = (await r.json()) as Record<string, { usdPrice?: number; launchpad?: string }>;
  const t = j[config.mint];
  if (!t?.usdPrice) return null;
  return { priceUsd: t.usdPrice, marketCapUsd: t.usdPrice * supply, volume24h: 0, dex: t.launchpad === 'pump.fun' ? 'pumpfun' : 'jupiter', url: `https://dexscreener.com/solana/${config.mint}` };
}

/** $ZEARN market data: DexScreener first (has volume), Jupiter as fallback. Cached 30s. */
export async function getMarket(supply = 0): Promise<Market> {
  if (!config.mint) return null;
  if (mcache && Date.now() - mcache.at < 30_000) return mcache.m;
  let m: Market = null;
  try {
    m = await fromDexScreener();
  } catch (e) {
    L.warn('dexscreener failed, trying jupiter:', (e as Error).message.slice(0, 80));
  }
  if (!m && supply > 0) {
    try {
      m = await fromJupiter(supply);
    } catch (e) {
      L.warn('jupiter failed', (e as Error).message);
    }
  }
  mcache = { at: Date.now(), m: m ?? mcache?.m ?? null };
  return mcache.m;
}
