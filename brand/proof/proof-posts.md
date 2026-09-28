# On-chain proof posts for X

Numbers are a live snapshot from 2026-09-28, about 14:09 UTC.
To refresh the cards and numbers later, run `node make-proof.mjs` from a folder with `@resvg/resvg-js` installed.
The script rewrites `proof-1.png` … `proof-5.png` and `proof-data.json`.
If the numbers change, update the text below to match `proof-data.json` before posting.

Every link below was checked and opens (Solscan may show a browser check first).

---

## Thread (5 posts + 1 receipts reply)

### 1/ · image `proof-1.png`

```
$ZEARN is live and the machine is running.

Sweep #1: 0.6353 SOL of pump.fun creator fees became 0.04797 ZEC in 35 seconds, routed through NEAR Intents.

No CEX. No bridge UI. Just receipts. 🧵
```

### 2/ · image `proof-2.png`

```
Redeem #1, full round trip:

🔥 21,039,216 $ZEARN burned
🛡 vault paid its exact pro-rata share: 0.00074433 ZEC
⚡ delivered as 0.00966905 SOL via NEAR Intents

The 2% fee stayed in the vault for holders.
(Team test burn. The pipe works end to end.)
```

### 3/ · image `proof-3.png`

```
Holding already earns ZEC.

102 holders are accruing from the Hold Pool, pro-rata to balance.
0.0233 ZEC kept by holders so far.
0.0051 ZEC forfeited by early sellers, recycled to the ones who stayed.

No staking. No lock. Just hold.
```

### 4/ · image `proof-4.png`

```
Our books = the chain.

Ledger total: 0.07793453 ZEC
intents.near balance: 0.07793453 ZEC

Match. Zero drift. The site checks this live on every refresh, not a screenshot of a spreadsheet.
```

### 5/ · image `proof-5.png`

```
Don't trust. Verify.

Token: https://pump.fun/coin/5d7jK77454XM7MwJBGjuS8mqSUe173ARmgFM1dGCpump
ZEC treasury: https://nearblocks.io/address/60eff3033c97d2a1083448989884895716267ee4392b2584b50874b5c44f3176
Live ledger: https://zearn-production.up.railway.app/#/ledger

Hold to zearn. Never zero. 🛡
```

### 6/ receipts reply · no image

```
Raw receipts:

Sweep #1 swap: https://explorer.near-intents.org/transactions/E1AkmFZYEV1c8CQQyTZPxNNQUYggZa1kvZprWB9JExNy
Burn: https://solscan.io/tx/5MGCDR2ZYjMKrVYr7WEDdmjN3Abpd3AowT9T4Ekuxf2QxAWVbbckyW62R8mNXerMBMDaDj9TCeq1NA1M3Dun58YR
Payout swap: https://explorer.near-intents.org/transactions/6a905ce4f8131a48766839b4f0accc6d0848c7a54e6154f1725e1f9ee2fc55fa
```

---

## Standalone posts (for later days)

### A · Zcash angle · image `proof-1.png`

```
Every $ZEARN trade on pump.fun pays creator fees.
Every one of those fees gets turned into Zcash.

2 sweeps so far: 0.0666 ZEC stacked, all on-chain.

The memecoin with a ZEC floor. 🛡
```

### B · NEAR Intents angle · image `proof-1.png`

```
How does SOL become ZEC in 35 seconds with no bridge UI?

NEAR Intents 1Click.
Fees land in the vault wallet, the keeper asks for a quote, sends the SOL, and ZEC lands in our intents.near treasury.

Receipt: https://explorer.near-intents.org/transactions/E1AkmFZYEV1c8CQQyTZPxNNQUYggZa1kvZprWB9JExNy
```

### C · Floor angle · image `proof-2.png`

```
"Floor" isn't a vibe. It's a button.

Burn $ZEARN, get your pro-rata share of the ZEC vault, paid in SOL, ZEC, USDC or NEAR.

Redeem #1 settled on-chain. Receipts in the image.
```

### D · Holders angle · image `proof-3.png`

```
102 wallets are earning ZEC right now by doing nothing.

Hold $ZEARN: your share unlocks from 15 min (5%) to 8 h (100%).
Sell early: the locked part goes back to the holders who stayed.

Paper hands fund diamond hands. 💎
```

---

## Proof part 2 (cards 6–10)

Live snapshot from 2026-09-28, about 14:35 UTC. Numbers are in `proof-data-2.json`.
Refresh only this set with `node make-proof.mjs 2`. It leaves cards 1–5 untouched.
Post these as a second thread, or one per day.

### 6 · image `proof-6.png` · treasury growth

```
8.5x the ZEC in 44 minutes.

0.0121 ZEC seeded at launch.
3 creator-fee sweeps added 0.0913 ZEC.
Redeems paid out 0.0007 ZEC.

Treasury now: 0.1027 ZEC, matched to the zatoshi on intents.near.

Volume in, Zcash stacked. 🛡
```

### 7 · image `proof-7.png` · swap efficiency

```
$144.81 of SOL went in.
$144.51 of ZEC came out.

99.8% of the value arrived as Zcash, priced at swap time. Average settle: 47 seconds.

The only gap is the NEAR Intents routing fee and spread. That's the whole bridge.
```

### 8 · image `proof-8.png` · floor math

```
The floor is just math.

Burn 2.1039% of supply → get 2.1039% of the vault, minus 2%.

Redeem #1: 0.03610028 ZEC vault × 2.1039% = 0.00075952
minus the 2% fee = 0.00074433 ZEC paid.

The fee stays. Every remaining token got a bit more backing.
```

### 9 · image `proof-9.png` · epochs

```
A ZEC payday every 5 minutes.

9 epochs in. 0.0655 ZEC has flowed through the Hold Pool, and 0.0427 ZEC is owed to holders right now.

Tall bars = fee sweeps. Small bars = paper hands' forfeits, recycled to the holders who stayed. 💎
```

### 10 · image `proof-10.png` · self-healing keeper

```
Transparency post.

Redeem #1 failed on its first try: an upstream NEAR RPC endpoint was retired.

What happened next:
• payout marked retry-safe
• ZEC never left the treasury
• keeper retried on its own 5 min later
• paid ✅

Something broke. No ZEC was lost.
```

---

## Every link, in one place

| What | Link |
| --- | --- |
| Token on pump.fun | https://pump.fun/coin/5d7jK77454XM7MwJBGjuS8mqSUe173ARmgFM1dGCpump |
| Creator-fee vault wallet | https://solscan.io/account/HLNPPyCUCr1DRVe3UYBjNVFMXMU4FWjjJfBcy4Z4EmEq |
| ZEC treasury account on NEAR | https://nearblocks.io/address/60eff3033c97d2a1083448989884895716267ee4392b2584b50874b5c44f3176 |
| Sweep #1, Solana deposit | https://solscan.io/tx/4HkDhJRHabnbeYpXDE89gJ7Gj6PUUaaGLCLXkr7HDm4HNXXt4vBJpWPy8ujbhy8DhtAFpXgsK8n79xxzghvUuqkP |
| Sweep #1, NEAR Intents receipt | https://explorer.near-intents.org/transactions/E1AkmFZYEV1c8CQQyTZPxNNQUYggZa1kvZprWB9JExNy |
| Sweep #1, NEAR tx | https://nearblocks.io/txns/6iXCFL9avdtgtW7Q6yGsmKJV7CJpbCXsMHgpKDtUuJhE |
| Redeem #1, burn | https://solscan.io/tx/5MGCDR2ZYjMKrVYr7WEDdmjN3Abpd3AowT9T4Ekuxf2QxAWVbbckyW62R8mNXerMBMDaDj9TCeq1NA1M3Dun58YR |
| Redeem #1, NEAR Intents receipt | https://explorer.near-intents.org/transactions/6a905ce4f8131a48766839b4f0accc6d0848c7a54e6154f1725e1f9ee2fc55fa |
| Redeem #1, NEAR tx | https://nearblocks.io/txns/3A6RZjTRbejydnKywTpgui5j86Dr33AxWziLzQ4Ajc3d |
| Redeem #1, SOL delivered | https://solscan.io/tx/2ZbHAPVZZzm1i7Kt1Vu94LKwY5AHmtU8pRxFgvtHAyZv1R67bXAHQ5N5jQ5GxQspWCX3m8hPQUemDAmYFt2s7GC2 |
| Live ledger | https://zearn-production.up.railway.app/#/ledger |
