import { config } from './config.js';
import { kvBig, kvGet, LEDGER } from './db.js';
import { getIntentsZecBalance } from './intents.js';
import { getMarket, getPrices } from './prices.js';
import { getMintSupply } from './solana.js';

export const ZEC_UNIT = 10n ** BigInt(config.zecDecimals);
export const zecToNumber = (raw: bigint) => Number(raw) / Number(ZEC_UNIT);
export const tokUnit = () => 10n ** BigInt(config.tokenDecimals);
export const tokToNumber = (raw: bigint) => Number(raw) / Number(tokUnit());

export type VaultState = {
  mint: string;
  dryRun: boolean;
  tokenDecimals: number;
  supplyRaw: string;
  supply: number;
  floorRaw: string;
  floorZec: number;
  holdPendingZec: number;
  holdOwedZec: number;
  intentsBalanceZec: number | null;
  prices: { sol: number; zec: number };
  floorPerTokenZec: number;
  floorPerTokenUsd: number;
  floorMcUsd: number;
  effectiveFloorMcUsd: number;
  market: Awaited<ReturnType<typeof getMarket>>;
  arbGapPct: number | null;
  params: {
    redeemFeeBps: number;
    floorSplitBps: number;
    treasuryShareBps: number;
    minRedeemTokens: number;
    minClaimZec: number;
    minClaimUsd: number;
    memoPrefix: string;
    vestCurve: [number, number][];
    sweepIntervalSec: number;
  };
  lastSweepAt: string | null;
  lastAccrualAt: string | null;
};

let cache: { at: number; s: VaultState } | null = null;

export async function getVaultState(): Promise<VaultState> {
  if (cache && Date.now() - cache.at < 15_000) return cache.s;
  const [supply, prices, market, intents] = await Promise.all([
    config.mint ? getMintSupply().catch(() => ({ supplyRaw: 0n, decimals: config.tokenDecimals })) : { supplyRaw: 0n, decimals: config.tokenDecimals },
    getPrices(),
    getMarket(),
    getIntentsZecBalance().catch(() => null),
  ]);
  const floorRaw = kvBig(LEDGER.floor);
  const floorZec = zecToNumber(floorRaw);
  const supplyN = Number(supply.supplyRaw) / 10 ** supply.decimals;
  const floorPerTokenZec = supplyN > 0 ? floorZec / supplyN : 0;
  const floorMcUsd = floorZec * prices.zec;
  const effectiveFloorMcUsd = floorMcUsd * (1 - config.redeemFeeBps / 10_000);
  const arbGapPct = market && market.marketCapUsd > 0 ? (effectiveFloorMcUsd / market.marketCapUsd - 1) * 100 : null;

  const s: VaultState = {
    mint: config.mint,
    dryRun: config.dryRun,
    tokenDecimals: supply.decimals,
    supplyRaw: supply.supplyRaw.toString(),
    supply: supplyN,
    floorRaw: floorRaw.toString(),
    floorZec,
    holdPendingZec: zecToNumber(kvBig(LEDGER.holdPending)),
    holdOwedZec: zecToNumber(kvBig(LEDGER.holdOwed)),
    intentsBalanceZec: intents === null ? null : zecToNumber(intents),
    prices,
    floorPerTokenZec,
    floorPerTokenUsd: floorPerTokenZec * prices.zec,
    floorMcUsd,
    effectiveFloorMcUsd,
    market,
    arbGapPct,
    params: {
      redeemFeeBps: config.redeemFeeBps,
      floorSplitBps: config.floorSplitBps,
      treasuryShareBps: config.treasuryShareBps,
      minRedeemTokens: config.minRedeemTokens,
      minClaimZec: config.minClaimZec,
      minClaimUsd: config.minClaimUsd,
      memoPrefix: config.memoPrefix,
      vestCurve: config.vestCurve,
      sweepIntervalSec: config.sweepIntervalSec,
    },
    lastSweepAt: kvGet(LEDGER.lastSweepAt, '') || null,
    lastAccrualAt: kvGet(LEDGER.lastAccrualAt, '') || null,
  };
  cache = { at: Date.now(), s };
  return s;
}

export const invalidateVaultCache = () => {
  cache = null;
};

/** Redeem preview: burn amountRaw tokens -> ZEC (raw) */
export function previewRedeem(amountRaw: bigint, supplyRaw: bigint, floorRaw: bigint) {
  if (supplyRaw <= 0n || amountRaw <= 0n) return { gross: 0n, fee: 0n, payout: 0n };
  const gross = (floorRaw * amountRaw) / supplyRaw;
  const fee = (gross * BigInt(config.redeemFeeBps)) / 10_000n;
  return { gross, fee, payout: gross - fee };
}
