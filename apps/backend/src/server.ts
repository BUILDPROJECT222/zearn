import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import { config } from './config.js';
import { db } from './db.js';
import { holderView } from './holdpool.js';
import { buildClaimMessage, issueNonce, submitClaim } from './jobs/claims.js';
import { getRedeem, submitRedeem } from './jobs/redeem.js';
import { getVaultState, previewRedeem, tokUnit } from './vault.js';
import { allow } from './ratelimit.js';
import { validateDest } from './payout.js';
import { PublicKey } from '@solana/web3.js';

export function buildServer() {
  // trustProxy: Railway's edge sets X-Forwarded-For, needed for per-IP rate limits
  const app = Fastify({ logger: false, trustProxy: true, bodyLimit: 256 * 1024 });
  const limited = (req: { ip: string }, reply: { code: (n: number) => { send: (b: unknown) => unknown } }, bucket: string, perMin: number) => {
    if (allow(`${bucket}:${req.ip}`, perMin)) return false;
    reply.code(429).send({ error: 'too many requests, slow down' });
    return true;
  };
  app.setReplySerializer((p) => JSON.stringify(p, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)));
  app.register(cors, { origin: config.corsOrigin.split(',').map((s) => s.trim()) });

  app.get('/api/health', async () => ({ ok: true, dryRun: config.dryRun, mint: config.mint || null }));

  // ---- Solana RPC proxy for the web app ----
  // Public mainnet RPC rejects browser calls (403) and the Helius key must not ship to the browser,
  // so the site talks to Solana through here. Only the read/send methods a wallet flow needs are allowed.
  const RPC_ALLOW = new Set([
    'getLatestBlockhash',
    'isBlockhashValid',
    'getBlockHeight',
    'getSlot',
    'getEpochInfo',
    'getVersion',
    'getGenesisHash',
    'getFeeForMessage',
    'getMinimumBalanceForRentExemption',
    'getBalance',
    'getAccountInfo',
    'getTokenAccountBalance',
    'getSignatureStatuses',
    'simulateTransaction',
    'sendTransaction',
  ]);
  app.post('/api/rpc', async (req, reply) => {
    if (limited(req, reply, 'rpc', 90)) return;
    const body = req.body as { method?: string } | { method?: string }[];
    const calls = Array.isArray(body) ? body : [body];
    if (calls.length === 0 || calls.length > 10 || calls.some((c) => !c || !RPC_ALLOW.has(String(c.method)))) {
      return reply.code(403).send({ jsonrpc: '2.0', id: null, error: { code: 403, message: 'method not allowed through the Zearn RPC proxy' } });
    }
    const r = await fetch(config.solanaRpc, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    reply.code(r.status).header('content-type', 'application/json');
    return reply.send(await r.text());
  });
  app.get('/api/state', async () => getVaultState());

  app.get('/api/sweeps', async (req) => {
    const limit = Math.min(200, Number((req.query as { limit?: string }).limit ?? 50));
    return db.prepare('SELECT id,created_at,updated_at,sol_lamports,zec_raw,floor_raw,hold_raw,deposit_address,tx_sig,status,error FROM sweeps ORDER BY id DESC LIMIT ?').all(limit);
  });
  app.get('/api/accruals', async (req) => {
    const limit = Math.min(200, Number((req.query as { limit?: string }).limit ?? 50));
    return db.prepare('SELECT * FROM accrual_epochs ORDER BY id DESC LIMIT ?').all(limit);
  });
  app.get('/api/redeems', async (req) => {
    const q = req.query as { wallet?: string; limit?: string };
    const limit = Math.min(200, Number(q.limit ?? 50));
    return q.wallet
      ? db.prepare('SELECT * FROM redeems WHERE wallet=? ORDER BY created_at DESC LIMIT ?').all(q.wallet, limit)
      : db.prepare('SELECT * FROM redeems ORDER BY created_at DESC LIMIT ?').all(limit);
  });
  app.get('/api/claims', async (req) => {
    const limit = Math.min(200, Number((req.query as { limit?: string }).limit ?? 50));
    return db.prepare('SELECT id,created_at,owner,amount_raw,dest_kind,status FROM claims ORDER BY id DESC LIMIT ?').all(limit);
  });

  // ---- Redeem ----
  app.get('/api/redeem/preview', async (req, reply) => {
    const q = req.query as { amount?: string; kind?: string };
    const amount = Number(q.amount ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) return reply.code(400).send({ error: 'invalid amount' });
    const s = await getVaultState();
    const amountRaw = BigInt(Math.floor(amount * Number(tokUnit())));
    const r = previewRedeem(amountRaw, BigInt(s.supplyRaw), BigInt(s.floorRaw));
    const belowMin = amount < config.minRedeemTokens;
    const payoutZero = r.payout <= 0n;
    // a payout must be worth paying: same floor as hold claims, higher for the Zcash bridge (~0.0003 ZEC fee)
    let minPayoutZec = Math.max(config.minClaimZec, s.prices.zec > 0 ? config.minClaimUsd / s.prices.zec : 0);
    if (q.kind === 'ZEC') minPayoutZec = Math.max(minPayoutZec, 0.0005);
    let minPayoutRaw = BigInt(Math.ceil(minPayoutZec * 1e8));
    if (minPayoutRaw < config.minPayoutRaw) minPayoutRaw = config.minPayoutRaw; // 1Click bridge minimum
    minPayoutZec = Number(minPayoutRaw) / 1e8;
    const belowMinPayout = !payoutZero && r.payout < minPayoutRaw;
    // single flag + reason so bots and manual burners can check before burning (the UI blocks on the same rule)
    const blockedReason = payoutZero
      ? BigInt(s.floorRaw) <= 0n
        ? 'vault is empty, payout would be 0 ZEC'
        : 'amount too small, payout rounds to 0 ZEC'
      : belowMin
        ? `below the ${config.minRedeemTokens} token minimum`
        : belowMinPayout
          ? `payout ${(Number(r.payout) / 1e8).toFixed(8)} ZEC is below the ${minPayoutZec.toFixed(6)} ZEC minimum${q.kind === 'ZEC' ? ' for Zcash payouts' : ''}; burn more`
          : null;
    return { amountRaw, ...r, belowMin, payoutZero, belowMinPayout, minPayoutRaw, ok: blockedReason === null, blockedReason, memoExample: `${config.memoPrefix}:<SOL|ZECSOL|USDC>:<solana wallet> | ${config.memoPrefix}:ZEC:<zcash address> | ${config.memoPrefix}:NEAR:<near account>` };
  });
  const redeemBody = z.object({ signature: z.string().min(80).max(100) });
  app.post('/api/redeem', async (req, reply) => {
    if (limited(req, reply, 'redeem', 20)) return;
    const b = redeemBody.safeParse(req.body);
    if (!b.success) return reply.code(400).send({ error: 'invalid signature' });
    return submitRedeem(b.data.signature);
  });
  app.get('/api/redeem/:sig', async (req, reply) => {
    const r = getRedeem((req.params as { sig: string }).sig);
    return r ?? reply.code(404).send({ error: 'not found' });
  });
  // Helius enhanced-transaction webhook (optional, faster than the polling scanner). Body: array of {signature, type, ...}
  app.post('/api/webhooks/helius', async (req, reply) => {
    // disabled unless a secret is configured: without it anyone could make us re-check arbitrary signatures
    if (!config.heliusWebhookSecret) return reply.code(404).send({ error: 'not found' });
    if (req.headers.authorization !== config.heliusWebhookSecret) return reply.code(401).send({ error: 'unauthorized' });
    const events = Array.isArray(req.body) ? (req.body as { signature?: string; type?: string }[]) : [];
    let queued = 0;
    for (const e of events) {
      if (!e.signature || (e.type && e.type !== 'BURN')) continue;
      if (getRedeem(e.signature)) continue;
      queued++;
      submitRedeem(e.signature).catch(() => {});
    }
    return { ok: true, queued };
  });

  // ---- Hold Pool ----
  app.get('/api/holder/:owner', async (req) => holderView((req.params as { owner: string }).owner));
  app.get('/api/claim/prepare', async (req, reply) => {
    if (limited(req, reply, 'claim-prepare', 12)) return;
    const q = req.query as { wallet?: string; kind?: string; addr?: string };
    if (!q.wallet || !q.kind || !q.addr) return reply.code(400).send({ error: 'wallet, kind and addr are required' });
    let wallet: string;
    let dest: { kind: string; addr: string };
    try {
      wallet = new PublicKey(q.wallet).toBase58();
      dest = validateDest(q.kind, q.addr);
    } catch (e) {
      return reply.code(400).send({ error: (e as Error).message || 'invalid wallet or destination' });
    }
    // only holders with something recorded can start a claim (keeps the nonce table from being spammed)
    if (BigInt(holderView(wallet).accruedRaw) <= 0n) return reply.code(400).send({ error: 'nothing accrued for this wallet yet' });
    const nonce = issueNonce(wallet);
    const issued = new Date().toISOString();
    return { nonce, issued, message: buildClaimMessage(wallet, dest.kind, dest.addr, nonce, issued) };
  });
  const claimBody = z.object({
    owner: z.string(),
    destKind: z.string(),
    destAddr: z.string(),
    nonce: z.string(),
    issued: z.string(),
    signature: z.string(),
  });
  app.post('/api/claim', async (req, reply) => {
    if (limited(req, reply, 'claim', 12)) return;
    const b = claimBody.safeParse(req.body);
    if (!b.success) return reply.code(400).send({ error: 'invalid body' });
    try {
      return await submitClaim(b.data);
    } catch (e) {
      return reply.code(400).send({ error: (e as Error).message });
    }
  });

  // Serve the built web app (single-service deploy). Hash routing, so only index.html is needed as fallback.
  // WEB_DIST wins; otherwise look next to the backend (repo layout apps/backend + apps/web)
  const candidates = [config.webDist, '../web/dist', 'web/dist', '/app/apps/web/dist'].filter(Boolean).map((p) => resolve(p));
  const root = candidates.find((p) => existsSync(p));
  console.log(`[server] web dist candidates: ${candidates.join(', ')} -> ${root ?? 'none'}`);
  if (root) {
    app.register(fastifyStatic, { root, prefix: '/', wildcard: true, index: ['index.html'] });
    app.setNotFoundHandler((req, reply) => {
      if (req.method === 'GET' && !req.url.startsWith('/api/')) return reply.sendFile('index.html');
      return reply.code(404).send({ error: 'not found' });
    });
  } else {
    console.warn('[server] no web dist found, API only');
  }

  return app;
}
