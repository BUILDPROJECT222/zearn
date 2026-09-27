import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { config } from './config.js';

mkdirSync(dirname(config.dbPath), { recursive: true });
export const db = new DatabaseSync(config.dbPath);
db.exec('PRAGMA journal_mode=WAL');
db.exec(`
CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL);

-- Creator-fee sweeps: SOL -> ZEC via NEAR Intents 1Click
CREATE TABLE IF NOT EXISTS sweeps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  sol_lamports TEXT NOT NULL,
  zec_raw TEXT,
  floor_raw TEXT,
  hold_raw TEXT,
  deposit_address TEXT,
  tx_sig TEXT,
  status TEXT NOT NULL,
  quote_json TEXT,
  error TEXT
);

-- Redeems: burn ZEARN -> pro-rata ZEC from the Floor Vault
CREATE TABLE IF NOT EXISTS redeems (
  signature TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  wallet TEXT,
  amount_raw TEXT,
  supply_raw TEXT,
  vault_raw TEXT,
  gross_raw TEXT,
  fee_raw TEXT,
  payout_raw TEXT,
  dest_kind TEXT,
  dest_addr TEXT,
  status TEXT NOT NULL,
  payout_ref TEXT,
  error TEXT
);

-- Hold Pool: holder snapshots, LIFO lots, accrual epochs, claims
CREATE TABLE IF NOT EXISTS holders (
  owner TEXT PRIMARY KEY,
  balance_raw TEXT NOT NULL,
  residual_acc TEXT NOT NULL DEFAULT '0',
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS lots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner TEXT NOT NULL,
  amount_raw TEXT NOT NULL,
  opened_at TEXT NOT NULL,
  accrued_acc TEXT NOT NULL DEFAULT '0',
  claimed_acc TEXT NOT NULL DEFAULT '0',
  closed INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS lots_owner ON lots(owner, closed);
CREATE TABLE IF NOT EXISTS accrual_epochs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL,
  hold_in_raw TEXT NOT NULL,
  forfeited_raw TEXT NOT NULL,
  eligible_supply_raw TEXT NOT NULL,
  holders_count INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS claims (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  owner TEXT NOT NULL,
  amount_raw TEXT NOT NULL,
  dest_kind TEXT NOT NULL,
  dest_addr TEXT NOT NULL,
  status TEXT NOT NULL,
  payout_ref TEXT,
  error TEXT
);
CREATE TABLE IF NOT EXISTS nonces (
  nonce TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  created_at TEXT NOT NULL
);
`);

export const now = () => new Date().toISOString();

export function kvGet(k: string, d = '0'): string {
  const r = db.prepare('SELECT v FROM kv WHERE k=?').get(k) as { v: string } | undefined;
  return r ? r.v : d;
}
export function kvSet(k: string, v: string) {
  db.prepare('INSERT INTO kv(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v').run(k, v);
}
export const kvBig = (k: string) => BigInt(kvGet(k, '0'));
export const kvAdd = (k: string, delta: bigint) => kvSet(k, (kvBig(k) + delta).toString());

/**
 * Internal ledger (unit: zatoshi = ZEC * 1e8):
 *  floor        = Floor Vault balance
 *  holdPending  = Hold Pool ZEC not yet distributed to lots (waiting for the next accrual epoch)
 *  holdOwed     = ZEC already accrued to lots and not yet paid out
 * floor + holdPending + holdOwed should track the ZEC balance held at intents.near.
 */
export const LEDGER = {
  floor: 'floor_raw',
  holdPending: 'hold_pending_raw',
  holdOwed: 'hold_owed_raw',
  lastSweepAt: 'last_sweep_at',
  lastAccrualAt: 'last_accrual_at',
} as const;

/** Extra precision for per-lot accrual: zatoshi * 1e9 so pro-rata dust is not lost */
export const ACC_SCALE = 1_000_000_000n;
