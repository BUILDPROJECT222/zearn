/**
 * Hold Pool claims: the user signs a message (not a transaction); the backend verifies the signature,
 * computes the claimable amount from lots (residual first, then oldest lots), and pays via intents.
 */
import { PublicKey } from '@solana/web3.js';
import nacl from 'tweetnacl';
import { config } from '../config.js';
import { db, kvAdd, LEDGER, now } from '../db.js';
import { holderView, markClaimed } from '../holdpool.js';
import { log } from '../log.js';
import { validateDest } from '../payout.js';
import { runPayout } from './payouts.js';
import { getPrices } from '../prices.js';
import { invalidateVaultCache, ZEC_UNIT } from '../vault.js';
import { randomBytes } from 'node:crypto';

const L = log('claim');

export function issueNonce(owner: string): string {
  // nonces live 10 minutes; drop anything older than an hour
  db.prepare('DELETE FROM nonces WHERE created_at < ?').run(new Date(Date.now() - 3_600_000).toISOString());
  const nonce = randomBytes(12).toString('hex');
  db.prepare('INSERT INTO nonces(nonce,owner,created_at) VALUES(?,?,?)').run(nonce, owner, now());
  return nonce;
}

export function buildClaimMessage(owner: string, kind: string, addr: string, nonce: string, issued: string) {
  return `${config.memoPrefix} hold claim\nwallet: ${owner}\ndest: ${kind}:${addr}\nnonce: ${nonce}\nissued: ${issued}`;
}

export type ClaimInput = { owner: string; destKind: string; destAddr: string; nonce: string; issued: string; signature: string };

let chain: Promise<unknown> = Promise.resolve();
/** One claim at a time: the claimable amount is read and committed without interleaving. */
export function submitClaim(inp: ClaimInput) {
  const p = chain.then(() => doSubmitClaim(inp));
  chain = p.catch(() => {});
  return p;
}

async function doSubmitClaim(inp: ClaimInput) {
  const owner = new PublicKey(inp.owner).toBase58();
  const dest = validateDest(inp.destKind, inp.destAddr);
  const n = db.prepare('SELECT * FROM nonces WHERE nonce=? AND owner=?').get(inp.nonce, owner) as unknown as { created_at: string } | undefined;
  if (!n) throw new Error('invalid nonce');
  if (Date.now() - Date.parse(n.created_at) > 10 * 60_000) throw new Error('nonce expired, try again');
  if (Math.abs(Date.now() - Date.parse(inp.issued)) > 10 * 60_000) throw new Error('invalid message timestamp');

  const msg = new TextEncoder().encode(buildClaimMessage(owner, dest.kind, dest.addr, inp.nonce, inp.issued));
  const sig = Uint8Array.from(Buffer.from(inp.signature, 'base64'));
  if (!nacl.sign.detached.verify(msg, sig, new PublicKey(owner).toBytes())) throw new Error('invalid signature');

  const view = holderView(owner);
  const amount = BigInt(view.claimableRaw);
  const { zec: zecUsd } = await getPrices();
  const minZec = Math.max(config.minClaimZec, zecUsd > 0 ? config.minClaimUsd / zecUsd : 0);
  let min = BigInt(Math.round(minZec * Number(ZEC_UNIT)));
  if (min < config.minPayoutRaw) min = config.minPayoutRaw;
  if (amount < min) throw new Error(`claimable ${Number(amount) / Number(ZEC_UNIT)} ZEC is below the minimum of ${minZec.toFixed(5)} ZEC (≈ $${config.minClaimUsd})`);

  let id: number;
  db.exec('BEGIN');
  try {
    db.prepare('DELETE FROM nonces WHERE nonce=?').run(inp.nonce);
    markClaimed(owner, amount);
    kvAdd(LEDGER.holdOwed, -amount);
    if (!config.dryRun) kvAdd(LEDGER.payoutOwed, amount); // owed until the payout is confirmed
    const ts = now();
    const r = db
      .prepare('INSERT INTO claims(created_at,updated_at,owner,amount_raw,dest_kind,dest_addr,status) VALUES(?,?,?,?,?,?,?)')
      .run(ts, ts, owner, amount.toString(), dest.kind, dest.addr, config.dryRun ? 'dry' : 'paying');
    id = Number(r.lastInsertRowid);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  invalidateVaultCache();
  L.info(`claim #${id} ${owner.slice(0, 6)} ${amount} raw -> ${dest.kind}:${dest.addr}`);
  if (!config.dryRun) await runPayout('claims', id);
  return db.prepare('SELECT * FROM claims WHERE id=?').get(id);
}
