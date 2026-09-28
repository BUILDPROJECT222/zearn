import { config } from './config.js';
import { isZcashAddress, mtTransfer, quotePayout, submitDeposit } from './intents.js';
import { PublicKey } from '@solana/web3.js';

/**
 * ZEC    = native ZEC to a transparent Zcash address (t1/t3; u1 behind ALLOW_UNIFIED_ZEC)
 * SOL    = SOL to a Solana wallet
 * ZECSOL = ZEC (SPL) to a Solana wallet
 * USDC   = USDC (SPL) to a Solana wallet
 * NEAR   = native NEAR to a NEAR account
 */
export type DestKind = 'ZEC' | 'SOL' | 'ZECSOL' | 'USDC' | 'NEAR';
export const DEST_KINDS: DestKind[] = ['ZEC', 'SOL', 'ZECSOL', 'USDC', 'NEAR'];

export const isNearAccount = (a: string) => /^([a-z0-9]+([-_.][a-z0-9]+)*\.(near|tg)|[0-9a-f]{64})$/.test(a);

export function validateDest(kind: string, addr: string): { kind: DestKind; addr: string } {
  if (kind === 'ZEC') {
    if (!isZcashAddress(addr)) throw new Error(config.allowUnifiedZec ? 'ZEC address must be t1…/t3… or u1…' : 'ZEC address must be transparent (t1… or t3…)');
    return { kind, addr };
  }
  if (kind === 'NEAR') {
    if (!isNearAccount(addr)) throw new Error('NEAR account must look like name.near or a 64-hex implicit account');
    return { kind, addr };
  }
  if (kind === 'SOL' || kind === 'ZECSOL' || kind === 'USDC') {
    const pk = new PublicKey(addr);
    if (!PublicKey.isOnCurve(pk.toBytes())) throw new Error('Solana address must be a regular wallet');
    return { kind, addr: pk.toBase58() };
  }
  throw new Error(`destination must be one of ${DEST_KINDS.join(', ')}`);
}

/** Parse burn memo: "<PREFIX>:<KIND>:<address>" */
export function parseMemo(memo: string | null): { kind: DestKind; addr: string } | null {
  if (!memo) return null;
  const m = memo.trim().match(/^([A-Za-z0-9_]+):(ZEC|SOL|ZECSOL|USDC|NEAR):(\S+)$/);
  if (!m || m[1].toUpperCase() !== config.memoPrefix.toUpperCase()) return null;
  try {
    return validateDest(m[2], m[3]);
  } catch {
    return null;
  }
}

const destAsset = (kind: DestKind) =>
  kind === 'SOL' ? config.assetSol : kind === 'ZECSOL' ? config.assetZecSol : kind === 'USDC' ? config.assetUsdcSol : kind === 'NEAR' ? config.assetNear : config.assetZec;

/**
 * Pay ZEC (raw) from the treasury's intents balance to a destination, always through 1Click:
 * quote (depositType INTENTS) -> mt_transfer the ZEC to the deposit address -> submit the NEAR tx hash.
 * Returns "1click:<depositAddress>:<nearTxHash>" so the status can be polled later.
 */
export async function executePayout(kind: DestKind, addr: string, zecRaw: bigint, onProgress?: (ref: string) => void): Promise<string> {
  if (zecRaw <= 0n) throw new Error('zero payout');
  const q = await quotePayout(destAsset(kind), zecRaw, addr, false);
  const dep = q.quote.depositAddress;
  if (!dep) throw new Error('1Click returned no depositAddress');
  // persisted before any funds move, so a restart can look the order up at 1Click
  onProgress?.(`1click:${dep}:`);
  const hash = await mtTransfer(dep, config.assetZec, BigInt(q.quote.amountIn), q.quote.depositMemo);
  onProgress?.(`1click:${dep}:${hash}`);
  try {
    await submitDeposit(hash, dep, { nearSenderAccount: config.nearAccountId, memo: q.quote.depositMemo });
  } catch {
    /* 1Click usually detects the deposit on its own; submit only speeds it up */
  }
  return `1click:${dep}:${hash}`;
}
