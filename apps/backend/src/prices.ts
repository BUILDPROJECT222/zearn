import { config } from './config.js';
import { log } from './log.js';

const L = log('prices');
let cache: { at: number; sol: number; zec: number } | null = null;

/** SOL & ZEC prices (USD) from CoinGecko, cached 60s */
export async function getPrices(): Promise<{ sol: number; zec: number }> {
  if (cache && Date.now() - cache.at < 60_000) return cache;
  try {
    const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana,zcash&vs_currencies=usd');
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

/** ZEARN market price from DexScreener (pump.fun bonding curve and PumpSwap are indexed there), cached 30s */
export async function getMarket(): Promise<Market> {
  if (!config.mint) return null;
  if (mcache && Date.now() - mcache.at < 30_000) return mcache.m;
  try {
    const r = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${config.mint}`);
    const j = (await r.json()) as { pairs?: { priceUsd?: string; marketCap?: number; fdv?: number; volume?: { h24?: number }; dexId?: string; url?: string; liquidity?: { usd?: number } }[] };
    const p = (j.pairs ?? []).sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];
    const m: Market = p
      ? { priceUsd: parseFloat(p.priceUsd ?? '0'), marketCapUsd: p.marketCap ?? p.fdv ?? 0, volume24h: p.volume?.h24 ?? 0, dex: p.dexId ?? '', url: p.url ?? '' }
      : null;
    mcache = { at: Date.now(), m };
  } catch (e) {
    L.warn('dexscreener failed', (e as Error).message);
    mcache = { at: Date.now(), m: mcache?.m ?? null };
  }
  return mcache.m;
}
