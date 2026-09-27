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

export function buildServer() {
  const app = Fastify({ logger: false });
  app.setReplySerializer((p) => JSON.stringify(p, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)));
  app.register(cors, { origin: config.corsOrigin.split(',').map((s) => s.trim()) });

  app.get('/api/health', async () => ({ ok: true, dryRun: config.dryRun, mint: config.mint || null }));
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
    const amount = Number((req.query as { amount?: string }).amount ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) return reply.code(400).send({ error: 'invalid amount' });
    const s = await getVaultState();
    const amountRaw = BigInt(Math.floor(amount * Number(tokUnit())));
    const r = previewRedeem(amountRaw, BigInt(s.supplyRaw), BigInt(s.floorRaw));
    return { amountRaw, ...r, belowMin: amount < config.minRedeemTokens, memoExample: `${config.memoPrefix}:<SOL|ZECSOL|USDC>:<solana wallet> | ${config.memoPrefix}:ZEC:<zcash address> | ${config.memoPrefix}:NEAR:<near account>` };
  });
  const redeemBody = z.object({ signature: z.string().min(80).max(100) });
  app.post('/api/redeem', async (req, reply) => {
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
    if (config.heliusWebhookSecret && req.headers.authorization !== config.heliusWebhookSecret) return reply.code(401).send({ error: 'unauthorized' });
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
    const q = req.query as { wallet?: string; kind?: string; addr?: string };
    if (!q.wallet || !q.kind || !q.addr) return reply.code(400).send({ error: 'wallet, kind and addr are required' });
    const nonce = issueNonce(q.wallet);
    const issued = new Date().toISOString();
    return { nonce, issued, message: buildClaimMessage(q.wallet, q.kind, q.addr, nonce, issued) };
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
