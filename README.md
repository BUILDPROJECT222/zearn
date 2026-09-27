# Zearn — $ZEARN, the ZEC-backed memecoin (pump.fun × NEAR Intents)

*Hold to zearn. The floor holds.* Zearn is the protocol; $ZEARN is its first coin.

Every $ZEARN trade on pump.fun generates a creator fee. A keeper sweeps the fee (SOL), swaps it to **ZEC** through **NEAR Intents 1Click**, and keeps it as a treasury balance at `intents.near` (publicly verifiable).

Payouts (redeems and hold claims) can go to SOL, ZEC (SPL) or USDC in a Solana wallet, native ZEC at a Zcash address (t1/t3 or u1), or native NEAR at a NEAR account. All of them are 1Click orders funded from the treasury balance.

Redeem burns are detected two ways: the website submits the signature right after the burn, and a **burn scanner** polls the mint's signatures every minute and picks up any burn whose memo starts with `ZEARN:` (an optional Helius webhook at `POST /api/webhooks/helius` does the same faster). Burns without a memo are not auto-detected; submitting their signature pays SOL to the burning wallet.

- **Floor Vault** (default 50%): burn $ZEARN → receive pro-rata ZEC minus a 2% redeem fee that stays in the vault. When the market price drops below the effective floor, arbitrage bots buy and redeem, pushing the price back to the floor.
- **Hold Pool** (default 50%): ZEC accrues to holders pro-rata every epoch. It unlocks by lot age (15 min 5% → 8 h 100%). Selling before unlock forfeits the rest back to the pool. Lots are consumed LIFO.

Full design spec: `ZFLOOR.md`. Interactive model: `docs/zfloor-calculator.html`.

## Structure

```
apps/backend   Keeper + indexer + API (Node 24, Fastify, node:sqlite)
  src/config.ts        all parameters (env)
  src/solana.ts        supply, burn tx parsing, holder snapshot, SOL transfers, pump fee claim (experimental)
  src/intents.ts       1Click quote/deposit/status, intents.near balance, mt_transfer funding
  src/jobs/scanner.ts  burn scanner (memo-filtered getSignaturesForAddress on the mint)
  src/vault.ts         public state: floor, floor/token, floor MC vs market, arb gap
  src/holdpool.ts      per-lot accrual, LIFO, forfeits, claimable
  src/payout.ts        1Click payouts from the intents balance: ZEC, SOL, ZEC-SPL, USDC, NEAR
  src/jobs/sweep.ts    SOL → ZEC → floor/hold split
  src/jobs/redeem.ts   verify burn + memo → compute → pay
  src/jobs/claims.ts   Hold Pool claims via signed message
  src/server.ts        REST API
apps/web       React 19 + Vite + Solana wallet adapter (dashboard, redeem, claim)
```

## Run (dev)

```bash
npm run install:all                    # installs apps/backend and apps/web (no workspaces: exFAT drives cannot symlink)
cp .env.example apps/backend/.env      # fill ZEARN_MINT, VAULT_SOL_SECRET, NEAR_*
cp apps/web/.env.example apps/web/.env
npm run dev:backend                    # http://localhost:8787
npm run dev:web                        # http://localhost:5173
npm run seed:dev --prefix apps/backend # optional: fake sweeps so the dashboard has data (DRY_RUN only)
```

`DRY_RUN=true` (default): sweeps only fetch quotes, redeems and claims are recorded but not paid. Turn it off only after every item in the checklist below passes.

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/state` | vault, supply, floor/token, floor MC, market (DexScreener), arb gap, parameters |
| GET | `/api/sweeps` · `/api/accruals` · `/api/redeems` · `/api/claims` | history |
| GET | `/api/redeem/preview?amount=` | payout simulation |
| POST | `/api/redeem` `{signature}` | register a burn tx. Memo `ZEARN:<KIND>:<address>` with KIND = `SOL`, `ZECSOL`, `USDC` (Solana wallet), `ZEC` (Zcash address) or `NEAR` (NEAR account) |
| POST | `/api/webhooks/helius` | optional Helius enhanced-transaction webhook (BURN events); `Authorization` header must equal `HELIUS_WEBHOOK_SECRET` |
| GET | `/api/holder/:owner` | lots, unlock %, accrued, claimable |
| GET | `/api/claim/prepare?wallet&kind&addr` → POST `/api/claim` | Hold Pool claim (signed message, not a tx) |

## Launch flow

1. Create the coin on pump.fun with the vault wallet as creator (or route 100% of creator fee sharing to the vault wallet). Set `ZEARN_MINT`.
2. Create a NEAR treasury account, set `NEAR_ACCOUNT_ID` + `NEAR_PRIVATE_KEY`. Anyone can verify its ZEC balance via `mt_batch_balance_of` on `intents.near`.
3. Use a Solana RPC that supports `getProgramAccounts` (Helius / Triton / QuickNode) for holder snapshots.
4. Run the backend with `DRY_RUN=true`; confirm 1Click quotes appear in the sweeps table and accrual epochs run.
5. Test live with small amounts: one sweep, one redeem to SOL, one redeem to a t-addr, one claim.
6. Set `DRY_RUN=false`, deploy the backend (VPS) and the web app (Vercel/Netlify with `VITE_API_URL`).

## Do we need to deploy a program / smart contract?

**v1: no.** Nothing is deployed on-chain by us.

| Piece | Who provides it | Deployed by us? |
|---|---|---|
| $ZEARN mint | pump.fun creates it | no |
| Burn + memo (redeem) | SPL Token program + Memo program (already on Solana) | no |
| SOL → ZEC swap, ZEC → SOL payout | NEAR Intents 1Click (hosted service) | no |
| ZEC treasury balance | `intents.near` verifier contract (already on NEAR) | no |
| Keeper, indexer, API | this repo, runs on a VPS | server, not a contract |

The trade-off is custody: the keeper's Solana hot wallet and NEAR account sign every swap and payout, so holders trust the team. **v2** is where contracts come in: a NEAR treasury contract that can only pay according to the rules (merkle-proof claims, pro-rata redeems), the vault wallet controlled through NEAR Chain Signatures instead of a human key, and the keeper attested inside a TEE. None of that is needed to launch.

## What has been verified (28 Sep 2026)

- [x] `npm run selftest --prefix apps/backend`: unlock curve, redeem math, memo parsing, hold-pool accrual, LIFO forfeits, residuals, claims and the ledger invariant. 24 checks pass.
- [x] **1Click asset ids** exist on `GET /v0/tokens`: `nep141:sol.omft.near` (9 dp) and `nep141:zec.omft.near` (8 dp). 1Click also lists ZEC as an SPL token on Solana (`1cs_v1:sol:spl:A7bd…QXaS`), a possible future payout route.
- [x] **1Click dry quotes** succeed in both directions with the exact request bodies the keeper sends: SOL→ZEC (`depositType ORIGIN_CHAIN`, `recipientType INTENTS`) and ZEC→SOL (`depositType INTENTS`, `recipientType DESTINATION_CHAIN`). Observed: 1 SOL → 0.0770 ZEC, refundFee 85035 lamports; 0.01 ZEC → 0.1293 SOL, withdrawFee 85142 lamports; a 20 bps 1Click app fee applies without an API key (`ONECLICK_API_KEY`).
- [x] **ZEC payouts go through 1Click too** (no hand-written bridge call). Dry quotes accepted ZEC→ZEC to a Zcash **unified (u1…)** address and to a checksum-valid **transparent (t1…)** address (withdrawFee 32 000 zatoshi ≈ 0.0003 ZEC, ~125 s), and ZEC→ZEC SPL on Solana (withdrawFee 20 992 zatoshi, ~7 s). On-chain, ZEC leaves `intents.near` via `ft_transfer_call` to `omni.bridge.near`; 1Click does that for us. The earlier `ft_withdraw` + `WITHDRAW_TO` assumption was wrong and has been removed.
- [x] **NEAR payouts**: dry quote ZEC→`nep141:wrap.near` to a NEAR account accepted (0.01 ZEC → 3.03 NEAR, ~10 s, no withdraw fee).
- [x] **USDC payouts**: dry quote ZEC→USDC on Solana accepted for 0.1 ZEC (~7 s, withdrawFee 10 187 µUSDC). The same route returned `Internal server error` for 0.01 ZEC three times in a row, so USDC likely has a higher minimum on 1Click's side; keep `MIN_CLAIM_USD` at or above $5 and expect very small USDC payouts to fail and be retried manually.
- [x] **intents.near balance view** `mt_batch_balance_of` returns balances for the ZEC/SOL token ids.
- [x] Web app builds for production (`vite build`, ~745 kB JS before code-splitting).

## Pre-launch verification checklist (still open)

- [ ] **Funding a 1Click INTENTS deposit** from the treasury balance: the keeper uses `mt_transfer` on `intents.near` to the quote's `depositAddress`, then `POST /v0/deposit/submit` with the NEAR tx hash. Confirm with one small real payout.
- [ ] **1Click minimum sizes** in production (`minAmountIn` on the live quote) and real payout fees; tune `MIN_REDEEM_TOKENS` and `MIN_CLAIM_ZEC` so small payouts are not eaten by the ~85k-lamport withdraw fee.
- [ ] **pump.fun creator fee claim**: `AUTO_CLAIM_PUMP` uses an untested `collect_creator_fee` account layout. Default is manual claiming on pump.fun. Post-graduation (PumpSwap) fees are not automated.
- [ ] **Eligible supply**: off-curve owners (PDAs) are excluded automatically. Add other pool / market-maker addresses to `EXCLUDE_OWNERS` if needed.
- [ ] **Regulatory review and disclaimers** (redeemable reserve + holding-based rewards).

## Custody & safety (v1)

The treasury is held by the keeper (Solana hot wallet + NEAR account). Holders must trust the team; mitigation: the intents balance is public and every sweep, redeem and claim is recorded and shown on the dashboard. v2 roadmap: vault via NEAR Chain Signatures, treasury contract, keeper inside a TEE.

Internal ledger invariant: `floor + hold_pending + hold_owed` ≈ ZEC balance at intents. A drift signals a failed or duplicated payout; check `redeems` / `claims` rows with status `failed`.
