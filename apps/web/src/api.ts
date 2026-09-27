// Production: the backend serves this app, so the API is same-origin. Dev: Vite on 5173, API on 8787.
export const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? (import.meta.env.PROD ? '' : 'http://localhost:8787');
export const RPC_URL = (import.meta.env.VITE_SOLANA_RPC as string | undefined) ?? 'https://api.mainnet-beta.solana.com';

export type Market = { priceUsd: number; marketCapUsd: number; volume24h: number; dex: string; url: string } | null;
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
  market: Market;
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
export type Redeem = {
  signature: string;
  created_at: string;
  wallet: string | null;
  amount_raw: string | null;
  payout_raw: string | null;
  fee_raw: string | null;
  dest_kind: string | null;
  dest_addr: string | null;
  status: string;
  payout_ref: string | null;
  error: string | null;
};
export type Lot = { id: number; amountRaw: string; openedAt: string; holdHours: number; unlock: number; accruedRaw: string; claimedRaw: string; claimableRaw: string };
export type Claim = { id: number; created_at: string; owner?: string; amount_raw: string; dest_kind: string; dest_addr?: string; status: string; payout_ref?: string | null; error?: string | null };
export type HolderView = { owner: string; balanceRaw: string; residualRaw: string; accruedRaw: string; claimableRaw: string; lots: Lot[]; claims: Claim[] };
export type Sweep = { id: number; created_at: string; sol_lamports: string; zec_raw: string | null; floor_raw: string | null; hold_raw: string | null; status: string; tx_sig: string | null };
export type Accrual = { id: number; ts: string; hold_in_raw: string; forfeited_raw: string; eligible_supply_raw: string; holders_count: number };

async function j<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${API_URL}${path}`, { ...init, headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) } });
  const body = (await r.json()) as T & { error?: string };
  if (!r.ok) throw new Error(body.error ?? `HTTP ${r.status}`);
  return body;
}

export const api = {
  state: () => j<VaultState>('/api/state'),
  sweeps: (limit = 20) => j<Sweep[]>(`/api/sweeps?limit=${limit}`),
  accruals: () => j<Accrual[]>('/api/accruals?limit=20'),
  redeems: (wallet?: string) => j<Redeem[]>(`/api/redeems?limit=20${wallet ? `&wallet=${wallet}` : ''}`),
  claims: () => j<Claim[]>('/api/claims?limit=20'),
  redeemPreview: (amount: number) => j<{ amountRaw: string; gross: string; fee: string; payout: string; belowMin: boolean }>(`/api/redeem/preview?amount=${amount}`),
  submitRedeem: (signature: string) => j<Redeem>('/api/redeem', { method: 'POST', body: JSON.stringify({ signature }) }),
  redeem: (sig: string) => j<Redeem>(`/api/redeem/${sig}`),
  holder: (owner: string) => j<HolderView>(`/api/holder/${owner}`),
  claimPrepare: (wallet: string, kind: string, addr: string) =>
    j<{ nonce: string; issued: string; message: string }>(`/api/claim/prepare?wallet=${wallet}&kind=${kind}&addr=${encodeURIComponent(addr)}`),
  submitClaim: (b: { owner: string; destKind: string; destAddr: string; nonce: string; issued: string; signature: string }) =>
    j<Claim>('/api/claim', { method: 'POST', body: JSON.stringify(b) }),
};

// ---------- formatting ----------
export const ZEC = 1e8;
export const zec = (raw: string | number | null | undefined, d = 5) => (raw == null ? '–' : (Number(raw) / ZEC).toFixed(d));
export const usd = (x: number | null | undefined, d = 0) =>
  x == null || !Number.isFinite(x) ? '–' : '$' + x.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
export const tok = (raw: string | number | null | undefined, decimals = 6) =>
  raw == null ? '–' : (Number(raw) / 10 ** decimals).toLocaleString('en-US', { maximumFractionDigits: 0 });
export const short = (s: string | null | undefined, n = 4) => (s ? `${s.slice(0, n)}…${s.slice(-n)}` : '–');
export const ago = (iso: string | null) => {
  if (!iso) return '–';
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${(m / 60).toFixed(1)} h ago` : `${Math.round(m / 1440)} d ago`;
};
export const hours = (h: number) => (h < 1 ? `${Math.round(h * 60)} min` : `${h.toFixed(1)} h`);
export const compact = (x: number) => (x >= 1e6 ? `${(x / 1e6).toFixed(2)}M` : x >= 1e3 ? `${(x / 1e3).toFixed(1)}K` : x.toFixed(0));
