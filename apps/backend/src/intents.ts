/**
 * NEAR Intents:
 *  - 1Click API (https://docs.near-intents.org/integration/distribution-channels/1click-api)
 *    for SOL -> ZEC (deposit from Solana, output kept as the treasury's intents balance)
 *    and for every payout from the intents balance: ZEC -> SOL, ZEC -> ZEC (SPL on Solana),
 *    ZEC -> ZEC on Zcash (same-asset transfer; 1Click routes it through the Omni bridge).
 *  - intents.near contract for balance checks (mt_batch_balance_of) and for funding 1Click
 *    deposits from the intents balance (mt_transfer to the quote's depositAddress).
 *
 * Verified 28 Sep 2026 with dry quotes: asset ids, all four request shapes, fees.
 * Still to confirm with one small live swap: mt_transfer funding of an INTENTS deposit.
 */
import { connect, keyStores, KeyPair, type Account } from 'near-api-js';
import { config } from './config.js';
import { log } from './log.js';

const L = log('intents');
export const INTENTS_CONTRACT = 'intents.near';

// ---------- 1Click ----------
export type QuoteRequest = {
  dry: boolean;
  swapType: 'EXACT_INPUT' | 'EXACT_OUTPUT';
  slippageTolerance: number; // bps
  originAsset: string;
  depositType: 'ORIGIN_CHAIN' | 'INTENTS';
  destinationAsset: string;
  amount: string;
  refundTo: string;
  refundType: 'ORIGIN_CHAIN' | 'INTENTS';
  recipient: string;
  recipientType: 'DESTINATION_CHAIN' | 'INTENTS';
  deadline: string;
  referral?: string;
  quoteWaitingTimeMs?: number;
};
export type Quote = {
  timestamp: string;
  signature: string;
  correlationId?: string;
  quoteRequest: QuoteRequest;
  quote: {
    depositAddress?: string;
    depositMemo?: string;
    amountIn: string;
    amountInFormatted: string;
    amountInUsd?: string;
    minAmountIn?: string;
    amountOut: string;
    amountOutFormatted: string;
    amountOutUsd?: string;
    minAmountOut: string;
    deadline?: string;
    timeWhenInactive?: string;
    timeEstimate?: number;
    refundFee?: string;
    withdrawFee?: string;
  };
};
export type SwapStatus = {
  status:
    | 'PENDING_DEPOSIT'
    | 'KNOWN_DEPOSIT_TX'
    | 'PROCESSING'
    | 'SUCCESS'
    | 'REFUNDED'
    | 'FAILED'
    | 'INCOMPLETE_DEPOSIT';
  swapDetails?: {
    amountIn?: string;
    amountOut?: string;
    amountInFormatted?: string;
    amountOutFormatted?: string;
    destinationChainTxHashes?: { hash: string; explorerUrl?: string }[];
    originChainTxHashes?: { hash: string; explorerUrl?: string }[];
    refundedAmount?: string;
  };
};

async function oneClick<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  // 1Click prefers X-API-Key; Bearer JWT is the legacy form. Without either, 1Click adds its own app fee (20 bps seen on dry quotes).
  if (config.oneClickApiKey) headers['x-api-key'] = config.oneClickApiKey;
  else if (config.oneClickJwt) headers.authorization = `Bearer ${config.oneClickJwt}`;
  const res = await fetch(`${config.oneClickUrl}${path}`, { ...init, headers: { ...headers, ...(init?.headers as Record<string, string>) } });
  const text = await res.text();
  if (!res.ok) throw new Error(`1Click ${path} ${res.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text) as T;
}

export const oneClickTokens = () => oneClick<unknown[]>('/v0/tokens');

const deadline = (min: number) => new Date(Date.now() + min * 60_000).toISOString();

/** SOL (from the Solana vault wallet) -> ZEC, output lands in the NEAR treasury's intents balance */
export function quoteSolToZec(lamports: bigint, dry: boolean) {
  const req: QuoteRequest = {
    dry,
    swapType: 'EXACT_INPUT',
    slippageTolerance: 100,
    originAsset: config.assetSol,
    depositType: 'ORIGIN_CHAIN',
    destinationAsset: config.assetZec,
    amount: lamports.toString(),
    refundTo: refundSolAddress(),
    refundType: 'ORIGIN_CHAIN',
    recipient: config.nearAccountId,
    recipientType: 'INTENTS',
    deadline: deadline(30),
    referral: 'zearn',
  };
  return oneClick<Quote>('/v0/quote', { method: 'POST', body: JSON.stringify(req) });
}

/**
 * Payout from the treasury's intents ZEC balance to a destination chain.
 * destinationAsset: config.assetSol (SOL to a Solana wallet), config.assetZecSol (ZEC SPL to a Solana wallet),
 * or config.assetZec (ZEC to a Zcash address; same-asset transfer, bridged by 1Click).
 */
export function quotePayout(destinationAsset: string, zecRaw: bigint, recipient: string, dry: boolean) {
  const req: QuoteRequest = {
    dry,
    swapType: 'EXACT_INPUT',
    slippageTolerance: 100,
    originAsset: config.assetZec,
    depositType: 'INTENTS',
    destinationAsset,
    amount: zecRaw.toString(),
    refundTo: config.nearAccountId,
    refundType: 'INTENTS',
    recipient,
    recipientType: 'DESTINATION_CHAIN',
    deadline: deadline(30),
    referral: 'zearn',
  };
  return oneClick<Quote>('/v0/quote', { method: 'POST', body: JSON.stringify(req) });
}

let _refund = '';
export function setRefundSolAddress(a: string) {
  _refund = a;
}
function refundSolAddress() {
  if (!_refund) throw new Error('refund address not set (vault keypair)');
  return _refund;
}

export const submitDeposit = (txHash: string, depositAddress: string, extra: { nearSenderAccount?: string; memo?: string } = {}) =>
  oneClick<unknown>('/v0/deposit/submit', { method: 'POST', body: JSON.stringify({ txHash, depositAddress, ...extra }) });

export const getSwapStatus = (depositAddress: string) =>
  oneClick<SwapStatus>(`/v0/status?depositAddress=${encodeURIComponent(depositAddress)}`);

export async function waitForSwap(depositAddress: string, timeoutMs = 25 * 60_000): Promise<SwapStatus> {
  const t0 = Date.now();
  let last: SwapStatus | null = null;
  while (Date.now() - t0 < timeoutMs) {
    try {
      last = await getSwapStatus(depositAddress);
      if (['SUCCESS', 'REFUNDED', 'FAILED'].includes(last.status)) return last;
    } catch (e) {
      L.warn('status error', (e as Error).message);
    }
    await new Promise((r) => setTimeout(r, 10_000));
  }
  throw new Error(`timed out waiting for swap ${depositAddress}, last status ${last?.status ?? '?'}`);
}

// ---------- NEAR account / intents.near ----------
let _account: Account | null = null;
export async function nearAccount(): Promise<Account> {
  if (_account) return _account;
  if (!config.nearAccountId || !config.nearPrivateKey) throw new Error('NEAR_ACCOUNT_ID / NEAR_PRIVATE_KEY is empty');
  const keyStore = new keyStores.InMemoryKeyStore();
  await keyStore.setKey(config.nearNetwork, config.nearAccountId, KeyPair.fromString(config.nearPrivateKey as never));
  // cast: near-api-js 5.x typings resolve to the cjs build, which loses NearConfig fields under NodeNext
  const near = await connect({ networkId: config.nearNetwork, nodeUrl: config.nearRpc, keyStore } as unknown as Parameters<typeof connect>[0]);
  _account = await near.account(config.nearAccountId);
  return _account;
}

/** Treasury ZEC balance at intents.near (raw, 8 decimals). Publicly verifiable by anyone. */
export async function getIntentsZecBalance(): Promise<bigint> {
  const acc = await nearAccount();
  const r = (await acc.viewFunction({
    contractId: INTENTS_CONTRACT,
    methodName: 'mt_batch_balance_of',
    args: { account_id: config.nearAccountId, token_ids: [config.assetZec] },
  })) as string[];
  return BigInt(r?.[0] ?? '0');
}

const TGAS = 1_000_000_000_000n;

/** Move intents tokens to a 1Click deposit address (depositType INTENTS). Returns the NEAR tx hash. */
export async function mtTransfer(receiverId: string, tokenId: string, amountRaw: bigint, memo?: string): Promise<string> {
  const acc = await nearAccount();
  const res = await acc.functionCall({
    contractId: INTENTS_CONTRACT,
    methodName: 'mt_transfer',
    args: { receiver_id: receiverId, token_id: tokenId, amount: amountRaw.toString(), ...(memo ? { memo } : {}) },
    gas: 100n * TGAS,
    attachedDeposit: 1n,
  });
  return res.transaction.hash as string;
}

/** Transparent (t1/t3, base58) or unified (u1, bech32m) Zcash address. Checksums are validated by 1Click at quote time. */
export const isZcashAddress = (a: string) => /^(t[13][1-9A-HJ-NP-Za-km-z]{33}|u1[02-9ac-hj-np-z]{40,})$/.test(a);
