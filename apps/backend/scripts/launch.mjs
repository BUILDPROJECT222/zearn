// Launch switch. Verifies everything, then points the live site at the real coin in ONE redeploy.
//
//   node scripts/launch.mjs --preflight          checks Railway secrets, NEAR account, vault wallet (no CA needed)
//   node scripts/launch.mjs <CA>                 preflight + on-chain CA checks, then sets ZEARN_MINT + DRY_RUN=false
//   node scripts/launch.mjs <CA> --check-only    all checks, changes nothing
//
// Secret values are read from Railway only to derive public keys; they are never printed.
import { Keypair, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import { KeyPair } from 'near-api-js';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const SITE = 'https://zearn-production.up.railway.app';
const SERVICE = 'zearn';
const PUMP = new PublicKey('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P');
const TOKEN_2022 = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
const TOKEN = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';

const args = process.argv.slice(2);
const preflightOnly = args.includes('--preflight');
const checkOnly = args.includes('--check-only');
const ca = args.find((a) => !a.startsWith('--'));

let failed = 0;
const ok = (msg) => console.log(`  ✓ ${msg}`);
const bad = (msg) => { console.log(`  ✗ ${msg}`); failed++; };
const info = (msg) => console.log(`    ${msg}`);

const railway = (...a) => execFileSync('railway', a, { cwd: resolve(here, '../../..'), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
function railwayVars() {
  const out = {};
  for (const line of railway('variables', '--service', SERVICE, '--kv').split(/\r?\n/)) {
    const i = line.indexOf('=');
    if (i > 0) out[line.slice(0, i)] = line.slice(i + 1);
  }
  return out;
}
const localEnv = (file) => {
  const p = resolve(here, '../secrets', file);
  if (!existsSync(p)) return {};
  const o = {};
  for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^#\s*public address:\s*(\S+)/);
    if (m) o.PUBLIC = m[1];
    const i = line.indexOf('=');
    if (i > 0 && !line.startsWith('#')) o[line.slice(0, i)] = line.slice(i + 1);
  }
  return o;
};
const rpc = async (url, method, params) => {
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
  const j = await r.json();
  if (j.error) throw new Error(`${method}: ${JSON.stringify(j.error).slice(0, 160)}`);
  return j.result;
};

// ---------------- preflight ----------------
console.log('\nPREFLIGHT');
const v = railwayVars();
const vault = localEnv('solana-vault.env');
const near = localEnv('near-treasury.env');
const RPC = v.SOLANA_RPC_URL;

for (const k of ['SOLANA_RPC_URL', 'VAULT_SOL_SECRET', 'NEAR_ACCOUNT_ID', 'NEAR_PRIVATE_KEY']) (v[k] ? ok : bad)(`Railway has ${k}`);

// the vault is whatever wallet VAULT_SOL_SECRET controls (it may be a wallet the owner created themselves)
let vaultPk = null;
if (v.VAULT_SOL_SECRET) {
  try {
    const s = v.VAULT_SOL_SECRET.trim();
    const kp = Keypair.fromSecretKey(s.startsWith('[') ? Uint8Array.from(JSON.parse(s)) : bs58.decode(s));
    vaultPk = kp.publicKey.toBase58();
    ok(`VAULT_SOL_SECRET is a valid Solana key → vault ${vaultPk}`);
    if (vault.PUBLIC && vault.PUBLIC !== vaultPk) info(`(differs from the generated vault in secrets/, which is fine if you chose your own wallet)`);
  } catch (e) {
    bad(`VAULT_SOL_SECRET does not parse as a base58 or JSON secret key: ${e.message}`);
  }
}
// the NEAR key must be a full-access key of NEAR_ACCOUNT_ID, checked on-chain
if (v.NEAR_ACCOUNT_ID && v.NEAR_PRIVATE_KEY) {
  try {
    const pub = KeyPair.fromString(v.NEAR_PRIVATE_KEY.trim()).getPublicKey().toString();
    const r = await fetch('https://rpc.mainnet.fastnear.com', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'query', params: { request_type: 'view_access_key', finality: 'final', account_id: v.NEAR_ACCOUNT_ID, public_key: pub } }) }).then((x) => x.json());
    if (r.result?.permission === 'FullAccess') ok(`NEAR_PRIVATE_KEY is a full-access key of ${v.NEAR_ACCOUNT_ID.slice(0, 12)}…`);
    else bad(`NEAR_PRIVATE_KEY is not a full-access key of NEAR_ACCOUNT_ID (${r.error?.cause?.name ?? 'no such key'}); fund the account first if it is new`);
  } catch (e) {
    bad(`NEAR_PRIVATE_KEY does not parse: ${e.message}`);
  }
}
(v.DB_PATH === '/data/zearn-mainnet.db' ? ok : bad)(`fresh ledger DB_PATH=${v.DB_PATH}`);
(!v.VEST_CURVE ? ok : bad)('no test VEST_CURVE override');
(Number(v.SWEEP_INTERVAL_SEC ?? 300) >= 300 ? ok : bad)(`sweep interval ${v.SWEEP_INTERVAL_SEC ?? 300} s`);

const nearId = v.NEAR_ACCOUNT_ID || near.NEAR_ACCOUNT_ID;
if (nearId) {
  const r = await fetch('https://rpc.mainnet.fastnear.com', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'query', params: { request_type: 'view_account', finality: 'final', account_id: nearId } }) }).then((x) => x.json());
  if (r.result) {
    const bal = Number(BigInt(r.result.amount) / 10n ** 20n) / 1e4;
    (bal >= 0.5 ? ok : bad)(`NEAR treasury active, ${bal} NEAR`);
  } else bad('NEAR treasury account not active yet (send ~1 NEAR to it)');
}
// ZEC already in the treasury: the fresh ledger starts at 0, so it must be seeded into the floor or withdrawn first
let treasuryZecRaw = 0n;
if (nearId) {
  const args_ = Buffer.from(JSON.stringify({ account_id: nearId, token_ids: ['nep141:zec.omft.near'] })).toString('base64');
  const r = await fetch('https://rpc.mainnet.fastnear.com', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'query', params: { request_type: 'call_function', finality: 'final', account_id: 'intents.near', method_name: 'mt_batch_balance_of', args_base64: args_ } }) }).then((x) => x.json());
  if (r.result) treasuryZecRaw = BigInt(JSON.parse(Buffer.from(r.result.result).toString())[0] ?? '0');
  if (treasuryZecRaw > 0n) info(`treasury already holds ${Number(treasuryZecRaw) / 1e8} ZEC on intents.near (${treasuryZecRaw} zatoshi)`);
  else ok('treasury ZEC balance is 0, the fresh ledger will match');
}
const vaultAddr = vaultPk;
if (RPC && vaultAddr) {
  const lamports = (await rpc(RPC, 'getBalance', [vaultAddr])).value;
  const sol = lamports / 1e9;
  (sol >= 0.03 ? ok : bad)(`vault wallet ${vaultAddr.slice(0, 6)}… holds ${sol} SOL (needs ~0.03+ for gas)`);
  // once live, everything above the 0.05 SOL reserve is swept into ZEC and becomes protocol money
  if (sol > 0.3 && !args.includes('--sweep-ok')) {
    if (preflightOnly) info(`WARNING: ${sol} SOL in the vault; once live ~${(sol - 0.05).toFixed(3)} SOL is swept into the treasury. Move the excess out, or launch with --sweep-ok if that is intended.`);
    else bad(`vault holds ${sol} SOL: going live would sweep ~${(sol - 0.05).toFixed(3)} SOL into the treasury. Move the excess out first, or pass --sweep-ok if it is meant as floor capital.`);
  }
}

// ---------------- coin ----------------
if (!preflightOnly) {
  console.log('\nCOIN');
  if (!ca) { bad('no CA given'); }
  else {
    let mintPk;
    try { mintPk = new PublicKey(ca); ok(`CA parses: ${ca}`); } catch { bad('CA is not a valid address'); }
    if (mintPk && RPC) {
      const acc = (await rpc(RPC, 'getAccountInfo', [ca, { encoding: 'jsonParsed' }])).value;
      if (!acc) bad('mint account not found on-chain');
      else {
        const info_ = acc.data.parsed?.info ?? {};
        ([TOKEN_2022, TOKEN].includes(acc.owner) ? ok : bad)(`token program ${acc.owner === TOKEN_2022 ? 'Token-2022' : acc.owner}`);
        (info_.decimals === 6 ? ok : bad)(`decimals ${info_.decimals}`);
        const supply = Number(info_.supply) / 10 ** (info_.decimals ?? 6);
        (supply >= 999_000_000 && supply <= 1_000_000_000 ? ok : bad)(`supply ${supply.toLocaleString('en-US')}`);
        (info_.mintAuthority == null ? ok : bad)('mint authority revoked (nobody can print more)');
        (info_.freezeAuthority == null ? ok : bad)('freeze authority revoked (nobody can freeze wallets)');
        const meta = (info_.extensions ?? []).find((e) => e.extension === 'tokenMetadata')?.state;
        if (meta) info(`name "${meta.name}", symbol "${meta.symbol}"`);
        const [curve] = PublicKey.findProgramAddressSync([Buffer.from('bonding-curve'), mintPk.toBuffer()], PUMP);
        const bc = (await rpc(RPC, 'getAccountInfo', [curve.toBase58(), { encoding: 'base64' }])).value;
        if (!bc) bad('pump.fun bonding curve not found (is this a pump.fun coin?)');
        else {
          const d = Buffer.from(bc.data[0], 'base64');
          const creator = new PublicKey(d.subarray(49, 81)).toBase58();
          (creator === vaultAddr ? ok : bad)(`pump.fun creator is the vault (${creator})`);
          info(`bonding curve ${d[48] === 1 ? 'complete (graduated)' : 'active'}`);
        }
      }
    }
  }
}

const seedFloor = args.includes('--seed-floor');
if (!preflightOnly && treasuryZecRaw > 0n && !seedFloor) {
  bad(`the treasury holds ${Number(treasuryZecRaw) / 1e8} ZEC but the ledger starts at 0: rerun with --seed-floor to credit it to the Floor Vault, or withdraw it first`);
}

console.log(`\n${failed === 0 ? 'ALL CHECKS PASSED' : `${failed} CHECK(S) FAILED`}`);
if (failed || preflightOnly || checkOnly) {
  process.exitCode = failed ? 1 : 0;
} else {
  // ---------------- switch ----------------
  console.log('\nSWITCHING THE SITE TO THE COIN');
  const sets = ['--set', `ZEARN_MINT=${ca}`, '--set', 'DRY_RUN=false'];
  if (treasuryZecRaw > 0n) sets.push('--set', `OPENING_FLOOR_RAW=${treasuryZecRaw}`);
  railway('variables', '--service', SERVICE, ...sets);
  ok(`ZEARN_MINT and DRY_RUN=false set${treasuryZecRaw > 0n ? `, opening floor ${Number(treasuryZecRaw) / 1e8} ZEC` : ''}; Railway is redeploying`);
  await waitLive();
}

async function waitLive() {
const t0 = Date.now();
for (;;) {
  await new Promise((r) => setTimeout(r, 10_000));
  try {
    const s = await fetch(`${SITE}/api/state`).then((r) => r.json());
    if (s.mint === ca && s.dryRun === false) {
      ok(`site is live on ${ca} after ${Math.round((Date.now() - t0) / 1000)} s`);
      info(`supply ${Math.round(s.supply).toLocaleString('en-US')} · market ${s.market ? `$${Math.round(s.market.marketCapUsd).toLocaleString('en-US')} MC` : 'not indexed yet (DexScreener/Jupiter usually within minutes)'}`);
      info(`treasury ${s.intentsBalanceZec ?? 'n/a'} ZEC · ledger match ${s.ledgerMatchesOnChain}`);
      break;
    }
  } catch { /* redeploy in progress */ }
  if (Date.now() - t0 > 10 * 60_000) { bad('site did not switch within 10 minutes, check Railway logs'); process.exitCode = 1; return; }
}
}
