import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
  type ParsedInstruction,
  type PartiallyDecodedInstruction,
} from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import bs58 from 'bs58';
import { createHash } from 'node:crypto';
import { config } from './config.js';
import { log } from './log.js';

const L = log('solana');
export const connection = new Connection(config.solanaRpc, 'confirmed');
export const PUMP_PROGRAM = new PublicKey('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P');
export const MEMO_PROGRAM = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

let _vault: Keypair | null = null;
export function vaultKeypair(): Keypair {
  if (_vault) return _vault;
  const s = config.vaultSolSecret.trim();
  if (!s) throw new Error('VAULT_SOL_SECRET is empty');
  const bytes = s.startsWith('[') ? Uint8Array.from(JSON.parse(s) as number[]) : bs58.decode(s);
  _vault = Keypair.fromSecretKey(bytes);
  return _vault;
}
export const mintPk = () => new PublicKey(config.mint);
export const TOKEN_2022_PROGRAM_ID = new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');

let _tokenProgram: PublicKey | null = null;
/** The token program that owns the mint. pump.fun mints are Token-2022 since 2026; older SPL mints still work. */
export async function getTokenProgram(): Promise<PublicKey> {
  if (_tokenProgram) return _tokenProgram;
  const info = await connection.getAccountInfo(mintPk(), 'confirmed');
  if (!info) throw new Error(`mint ${config.mint} not found`);
  _tokenProgram = info.owner;
  L.info(`mint owned by ${info.owner.equals(TOKEN_2022_PROGRAM_ID) ? 'Token-2022' : info.owner.equals(TOKEN_PROGRAM_ID) ? 'SPL Token' : info.owner.toBase58()}`);
  return _tokenProgram;
}

export async function getMintSupply(): Promise<{ supplyRaw: bigint; decimals: number }> {
  const s = await connection.getTokenSupply(mintPk(), 'confirmed');
  return { supplyRaw: BigInt(s.value.amount), decimals: s.value.decimals };
}

export async function getSolBalanceLamports(pk: PublicKey): Promise<bigint> {
  return BigInt(await connection.getBalance(pk, 'confirmed'));
}

export async function sendSol(to: string, lamports: bigint): Promise<string> {
  const kp = vaultKeypair();
  const tx = new Transaction().add(
    SystemProgram.transfer({ fromPubkey: kp.publicKey, toPubkey: new PublicKey(to), lamports }),
  );
  return sendAndConfirmTransaction(connection, tx, [kp], { commitment: 'confirmed' });
}

export const lamportsToSol = (l: bigint) => Number(l) / LAMPORTS_PER_SOL;
export const solToLamports = (s: number) => BigInt(Math.floor(s * LAMPORTS_PER_SOL));

// ---------- Burn (redeem) ----------
export type BurnInfo = {
  wallet: string;
  amountRaw: bigint;
  memo: string | null;
  slot: number;
  blockTime: number | null;
};

function isParsed(ix: ParsedInstruction | PartiallyDecodedInstruction): ix is ParsedInstruction {
  return (ix as ParsedInstruction).parsed !== undefined;
}

/** Read a burn tx: must be finalized, successful, burn our mint, memo via the spl-memo program */
export async function parseBurnTx(signature: string): Promise<BurnInfo> {
  const st = await connection.getSignatureStatuses([signature], { searchTransactionHistory: true });
  const s = st.value[0];
  if (!s) throw new Error('signature not found');
  if (s.err) throw new Error('transaction failed on-chain');
  if (s.confirmationStatus !== 'finalized') throw new Error('not finalized yet, retry shortly');

  const tx = await connection.getParsedTransaction(signature, {
    commitment: 'finalized',
    maxSupportedTransactionVersion: 0,
  });
  if (!tx || tx.meta?.err) throw new Error('invalid transaction');

  const all: (ParsedInstruction | PartiallyDecodedInstruction)[] = [...tx.transaction.message.instructions];
  for (const inner of tx.meta?.innerInstructions ?? []) all.push(...inner.instructions);

  const mint = config.mint;
  let wallet: string | null = null;
  let amount = 0n;
  let memo: string | null = null;
  for (const ix of all) {
    if (!isParsed(ix)) continue;
    if ((ix.program === 'spl-token' || ix.program === 'spl-token-2022') && (ix.parsed?.type === 'burn' || ix.parsed?.type === 'burnChecked')) {
      const info = ix.parsed.info;
      if (info.mint !== mint) continue;
      const a = BigInt(info.amount ?? info.tokenAmount?.amount ?? '0');
      amount += a;
      wallet = wallet ?? info.authority ?? info.multisigAuthority ?? null;
    } else if (ix.program === 'spl-memo' && typeof ix.parsed === 'string') {
      memo = ix.parsed;
    }
  }
  if (amount === 0n || !wallet) throw new Error('no ZEARN burn found in this transaction');
  return { wallet, amountRaw: amount, memo, slot: tx.slot, blockTime: tx.blockTime ?? null };
}

// ---------- Holder snapshot (Hold Pool) ----------
/**
 * Every token account of our mint, aggregated per owner.
 * Off-curve owners (PDAs: bonding curve, PumpSwap/Raydium pools, programs) are not eligible.
 *
 * Queries whichever token program owns the mint (Token-2022 for current pump.fun coins). No dataSize
 * filter: Token-2022 accounts carry extensions and are longer than 165 bytes. The data slice keeps the
 * response small (owner + amount only), which the public mainnet RPC accepts.
 */
export async function snapshotHolders(): Promise<Map<string, bigint>> {
  const program = await getTokenProgram();
  const accounts = await connection.getProgramAccounts(program, {
    commitment: 'confirmed',
    dataSlice: { offset: 32, length: 40 }, // owner (32) + amount (8)
    filters: [{ memcmp: { offset: 0, bytes: config.mint } }],
  });
  const out = new Map<string, bigint>();
  const excluded = new Set(config.excludeOwners);
  // the protocol's own vault wallet (e.g. from a dev buy at launch) never earns hold rewards
  if (config.vaultSolSecret) excluded.add(vaultKeypair().publicKey.toBase58());
  for (const { account } of accounts) {
    const d = account.data as Buffer;
    if (d.length < 40) continue;
    const owner = new PublicKey(d.subarray(0, 32));
    const amount = d.readBigUInt64LE(32);
    if (amount === 0n) continue;
    const o = owner.toBase58();
    if (excluded.has(o)) continue;
    if (!PublicKey.isOnCurve(owner.toBytes())) continue;
    out.set(o, (out.get(o) ?? 0n) + amount);
  }
  L.info(`snapshot: ${accounts.length} token accounts, ${out.size} eligible holders`);
  return out;
}

// ---------- pump.fun creator fee (EXPERIMENTAL) ----------
/**
 * Claim bonding-curve creator fees (collect_creator_fee on the pump program).
 * Account layout follows the known pump IDL; MUST be tested with small amounts before use.
 * Post-graduation fees (PumpSwap, collect_coin_creator_fee) are not automated: claim manually.
 */
export async function claimPumpCreatorFee(): Promise<string> {
  const kp = vaultKeypair();
  const disc = createHash('sha256').update('global:collect_creator_fee').digest().subarray(0, 8);
  const [creatorVault] = PublicKey.findProgramAddressSync(
    [Buffer.from('creator-vault'), kp.publicKey.toBuffer()],
    PUMP_PROGRAM,
  );
  const [eventAuthority] = PublicKey.findProgramAddressSync([Buffer.from('__event_authority')], PUMP_PROGRAM);
  const ix = new TransactionInstruction({
    programId: PUMP_PROGRAM,
    keys: [
      { pubkey: kp.publicKey, isSigner: true, isWritable: true },
      { pubkey: creatorVault, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: eventAuthority, isSigner: false, isWritable: false },
      { pubkey: PUMP_PROGRAM, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(disc),
  });
  const sig = await sendAndConfirmTransaction(connection, new Transaction().add(ix), [kp]);
  L.info('collect_creator_fee', sig);
  return sig;
}
