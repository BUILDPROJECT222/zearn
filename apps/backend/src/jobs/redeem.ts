/**
 * Redeem: the user burns ZEARN (+ destination memo) on Solana and submits the signature to the API.
 * The backend verifies the finalized tx, computes the pro-rata share of the Floor Vault, and pays via intents.
 * Invalid memo -> fallback: pay SOL to the burning wallet (tokens are already burned, never forfeit).
 */
import { config } from '../config.js';
import { db, kvAdd, kvBig, LEDGER, now } from '../db.js';
import { log } from '../log.js';
import { parseMemo } from '../payout.js';
import { runPayout } from './payouts.js';
import { getMintSupply, parseBurnTx } from '../solana.js';
import { invalidateVaultCache, previewRedeem } from '../vault.js';

const L = log('redeem');
let chain: Promise<unknown> = Promise.resolve();
/** Serialize processing so two redeems never read the same vault snapshot */
const serial = <T>(fn: () => Promise<T>): Promise<T> => {
  const p = chain.then(fn, fn);
  chain = p.catch(() => {});
  return p;
};

export type RedeemRow = {
  signature: string;
  created_at: string;
  updated_at: string;
  wallet: string | null;
  amount_raw: string | null;
  supply_raw: string | null;
  vault_raw: string | null;
  gross_raw: string | null;
  fee_raw: string | null;
  payout_raw: string | null;
  dest_kind: string | null;
  dest_addr: string | null;
  status: string;
  payout_ref: string | null;
  error: string | null;
};

export const getRedeem = (sig: string) => db.prepare('SELECT * FROM redeems WHERE signature=?').get(sig) as unknown as RedeemRow | undefined;

export function submitRedeem(signature: string): Promise<RedeemRow> {
  return serial(async () => {
    if (!getRedeem(signature)) {
      const ts = now();
      db.prepare('INSERT INTO redeems(signature,created_at,updated_at,status) VALUES(?,?,?,?)').run(signature, ts, ts, 'pending');
    }
    return processRedeem(signature);
  });
}

async function processRedeem(signature: string): Promise<RedeemRow> {
  const row = getRedeem(signature)!;
  if (row.status !== 'pending') return row;
  const set = (fields: Record<string, string | null>) => {
    const cols = Object.keys(fields);
    db.prepare(`UPDATE redeems SET updated_at=? ${cols.map((c) => `, ${c}=?`).join('')} WHERE signature=?`).run(now(), ...cols.map((c) => fields[c]), signature);
  };

  let burn;
  try {
    burn = await parseBurnTx(signature);
  } catch (e) {
    const msg = (e as Error).message;
    if (msg.includes('finalized') || msg.includes('not found')) {
      // real burns finalize within a minute; anything still unknown after 15 minutes was never a valid burn
      if (Date.now() - Date.parse(row.created_at) > 15 * 60_000) {
        set({ status: 'rejected', error: `gave up: ${msg}` });
      } else {
        set({ error: msg });
      }
      return getRedeem(signature)!;
    }
    set({ status: 'rejected', error: msg });
    return getRedeem(signature)!;
  }

  const dest = parseMemo(burn.memo) ?? { kind: 'SOL' as const, addr: burn.wallet };
  const { supplyRaw } = await getMintSupply();
  const supplyBefore = supplyRaw + burn.amountRaw;
  const vault = kvBig(LEDGER.floor);
  const { gross, fee, payout } = previewRedeem(burn.amountRaw, supplyBefore, vault);
  if (payout <= 0n) {
    // tokens are already burned on-chain and cannot be returned; record it clearly so it is visible in the ledger
    set({
      status: 'rejected',
      wallet: burn.wallet,
      amount_raw: burn.amountRaw.toString(),
      supply_raw: supplyBefore.toString(),
      vault_raw: vault.toString(),
      error: vault <= 0n ? 'zero payout: the vault was empty at burn time (tokens are burned, nothing to pay)' : 'zero payout: amount too small for the vault size',
    });
    return getRedeem(signature)!;
  }
  if (payout < config.minPayoutRaw) {
    // below what 1Click can deliver: nothing leaves the vault, so the burned share simply stays in the floor for everyone
    set({
      status: 'rejected',
      wallet: burn.wallet,
      amount_raw: burn.amountRaw.toString(),
      supply_raw: supplyBefore.toString(),
      vault_raw: vault.toString(),
      gross_raw: gross.toString(),
      payout_raw: payout.toString(),
      error: `payout ${payout} zatoshi is below the ${config.minPayoutRaw} zatoshi bridge minimum; tokens are burned, their share stays in the floor`,
    });
    invalidateVaultCache();
    return getRedeem(signature)!;
  }
  // move the payout out of the floor into "owed" until the payout is confirmed (the fee stays in the vault)
  kvAdd(LEDGER.floor, -payout);
  if (!config.dryRun) kvAdd(LEDGER.payoutOwed, payout);
  set({
    status: config.dryRun ? 'verified' : 'paying',
    wallet: burn.wallet,
    amount_raw: burn.amountRaw.toString(),
    supply_raw: supplyBefore.toString(),
    vault_raw: vault.toString(),
    gross_raw: gross.toString(),
    fee_raw: fee.toString(),
    payout_raw: payout.toString(),
    dest_kind: dest.kind,
    dest_addr: dest.addr,
    error: burn.memo && !parseMemo(burn.memo) ? 'invalid memo, falling back to SOL payout to the burning wallet' : null,
  });
  invalidateVaultCache();
  L.info(`redeem ${signature.slice(0, 8)}: burn ${burn.amountRaw} -> ${payout} raw ZEC to ${dest.kind}:${dest.addr}`);
  if (config.dryRun) return getRedeem(signature)!;

  await runPayout('redeems', signature);
  return getRedeem(signature)!;
}

/** Retry redeems still pending (not finalized at submit time) */
export async function retryPendingRedeems() {
  const rows = db.prepare("SELECT signature FROM redeems WHERE status='pending'").all() as unknown as { signature: string }[];
  for (const r of rows) await serial(() => processRedeem(r.signature)).catch((e) => L.warn('retry', (e as Error).message));
}
