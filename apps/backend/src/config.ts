import 'dotenv/config';

const env = (k: string, d = ''): string => {
  const v = process.env[k];
  return v === undefined || v === '' ? d : v;
};
const num = (k: string, d: number) => {
  const v = parseFloat(env(k, String(d)));
  return Number.isFinite(v) ? v : d;
};
const bool = (k: string, d: boolean) => {
  const v = env(k, d ? 'true' : 'false').toLowerCase();
  return v === 'true' || v === '1' || v === 'yes';
};

/** Unlock curve: "hours:percent, ..." -> sorted [[hours, fraction], ...], always starting at [0,0] */
export function parseVestCurve(s: string): [number, number][] {
  const pts = s
    .split(',')
    .map((p) => p.trim().split(':').map(Number))
    .filter((a) => a.length === 2 && a.every((x) => Number.isFinite(x)))
    .map(([h, v]) => [h, v / 100] as [number, number])
    .sort((a, b) => a[0] - b[0]);
  return [[0, 0], ...pts];
}

export const config = {
  // Solana
  solanaRpc: env('SOLANA_RPC_URL', 'https://api.mainnet-beta.solana.com'),
  mint: env('ZEARN_MINT'),
  tokenDecimals: num('TOKEN_DECIMALS', 6),
  vaultSolSecret: env('VAULT_SOL_SECRET'),
  solReserve: num('SOL_RESERVE', 0.05),
  minSweepSol: num('MIN_SWEEP_SOL', 0.1),
  sweepIntervalSec: num('SWEEP_INTERVAL_SEC', 300),
  autoClaimPump: bool('AUTO_CLAIM_PUMP', false),
  // Optional ops/dev wallet receiving (100 - TREASURY_SHARE_PCT)% of fees. Empty = 100% to treasury
  opsSolAddress: env('OPS_SOL_ADDRESS'),

  // NEAR / Intents
  nearNetwork: env('NEAR_NETWORK', 'mainnet'),
  nearRpc: env('NEAR_RPC_URL', 'https://rpc.mainnet.near.org'),
  nearAccountId: env('NEAR_ACCOUNT_ID'),
  nearPrivateKey: env('NEAR_PRIVATE_KEY'),
  oneClickUrl: env('ONECLICK_URL', 'https://1click.chaindefuser.com'),
  oneClickJwt: env('ONECLICK_JWT'),
  oneClickApiKey: env('ONECLICK_API_KEY'),
  assetSol: env('ASSET_SOL', 'nep141:sol.omft.near'),
  assetZec: env('ASSET_ZEC', 'nep141:zec.omft.near'),
  // ZEC as an SPL token on Solana (1Click asset id), for "ZEC to my Solana wallet" payouts
  assetZecSol: env('ASSET_ZEC_SOL', '1cs_v1:sol:spl:A7bdiYdS5GjqGFtxf17ppRHtDKPkkRqbKtR27dxvQXaS'),
  // native NEAR (1Click unwraps wrap.near on delivery) and USDC on Solana
  assetNear: env('ASSET_NEAR', 'nep141:wrap.near'),
  assetUsdcSol: env('ASSET_USDC_SOL', 'nep141:sol-5ce3bf3a31af18be40ba30f721101b4341690186.omft.near'),
  zecDecimals: num('ZEC_DECIMALS', 8),

  // Protocol
  treasuryShareBps: Math.round(num('TREASURY_SHARE_PCT', 90) * 100),
  floorSplitBps: Math.round(num('FLOOR_SPLIT_PCT', 50) * 100),
  redeemFeeBps: num('REDEEM_FEE_BPS', 200),
  minRedeemTokens: num('MIN_REDEEM_TOKENS', 1000),
  minClaimZec: num('MIN_CLAIM_ZEC', 0.002),
  // 1Click refuses ZEC payouts below ~7490 zatoshi ("Amount is too low for bridge"); never try to pay less
  minPayoutRaw: BigInt(Math.round(num('MIN_PAYOUT_RAW', 8000))),
  // effective minimum claim = max(MIN_CLAIM_ZEC, MIN_CLAIM_USD at the current ZEC price)
  minClaimUsd: num('MIN_CLAIM_USD', 5),
  // burn scanner: finds burns with a ZEARN memo on-chain even if the user never submits the signature
  burnScanEnabled: bool('BURN_SCAN_ENABLED', true),
  burnScanIntervalSec: num('BURN_SCAN_INTERVAL_SEC', 60),
  // optional Helius webhook (enhanced transactions, type BURN); the header value must equal this secret
  heliusWebhookSecret: env('HELIUS_WEBHOOK_SECRET'),
  memoPrefix: env('MEMO_PREFIX', 'ZEARN'),
  // Unified (u1) Zcash addresses were accepted by 1Click dry quotes but never tested with a real payout.
  // Keep off until one real u1 payout has landed; transparent t1/t3 only meanwhile.
  allowUnifiedZec: bool('ALLOW_UNIFIED_ZEC', false),
  vestCurve: parseVestCurve(env('VEST_CURVE', '0.25:5, 0.5:10, 1:20, 2:35, 4:60, 6:80, 8:100')),
  excludeOwners: env('EXCLUDE_OWNERS', '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  // Public links shown on the site (optional). X handle without the @.
  xHandle: env('X_HANDLE').replace(/^@/, '').trim(),

  // Server
  port: num('PORT', 8787),
  // Directory of the built web app to serve at "/" (empty = API only)
  webDist: env('WEB_DIST'),
  dbPath: env('DB_PATH', './data/zearn.db'),
  corsOrigin: env('CORS_ORIGIN', 'http://localhost:5173'),
  dryRun: bool('DRY_RUN', true),
};

/** Unlock fraction (0..1) for a hold duration in hours, linear between curve points */
export function unlockFraction(hours: number): number {
  const p = config.vestCurve;
  if (hours <= 0) return 0;
  if (hours >= p[p.length - 1][0]) return p[p.length - 1][1];
  for (let i = 0; i < p.length - 1; i++) {
    const [a, va] = p[i];
    const [b, vb] = p[i + 1];
    if (hours >= a && hours <= b) return va + ((vb - va) * (hours - a)) / (b - a);
  }
  return 0;
}
