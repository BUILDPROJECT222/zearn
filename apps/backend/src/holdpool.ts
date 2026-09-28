/**
 * Hold Pool: pro-rata accrual per lot, unlock by lot age, LIFO on sell.
 *
 * Each epoch (after the sweep):
 *  1. ZEC in hold_pending (this epoch's fees + last epoch's forfeits) is split across ALL open lots
 *     pro-rata by token amount, based on balances BEFORE the diff (anti double-dip: a new buyer
 *     gets no share of fees that arrived before they bought).
 *  2. The on-chain snapshot is compared with recorded balances:
 *     - up   -> new lot with its own clock
 *     - down -> newest lots are cut first; the unvested part of their accrual is forfeited
 *              back to hold_pending, the vested-but-unclaimed part is kept as the holder's
 *              residual (still claimable).
 */
import { config, unlockFraction } from './config.js';
import { ACC_SCALE, db, kvAdd, kvBig, kvSet, LEDGER, now } from './db.js';
import { log } from './log.js';

const L = log('holdpool');

type LotRow = { id: number; owner: string; amount_raw: string; opened_at: string; accrued_acc: string; claimed_acc: string; closed: number };
type HolderRow = { owner: string; balance_raw: string; residual_acc: string; updated_at: string };

const hoursSince = (iso: string, at = Date.now()) => (at - Date.parse(iso)) / 3_600_000;
const fracBig = (x: bigint, f: number) => (x * BigInt(Math.round(f * 1_000_000))) / 1_000_000n;

export function lotUnlock(lot: Pick<LotRow, 'opened_at'>, at = Date.now()) {
  return unlockFraction(hoursSince(lot.opened_at, at));
}
export function lotClaimableAcc(lot: LotRow, at = Date.now()): bigint {
  const vested = fracBig(BigInt(lot.accrued_acc), lotUnlock(lot, at));
  const c = vested - BigInt(lot.claimed_acc);
  return c > 0n ? c : 0n;
}

/** Cut lots LIFO by amount; return the forfeited ZEC (raw) */
function consumeLots(owner: string, amount: bigint, ts: string): bigint {
  const lots = db
    .prepare('SELECT * FROM lots WHERE owner=? AND closed=0 ORDER BY opened_at DESC, id DESC')
    .all(owner) as unknown as LotRow[];
  let remaining = amount;
  let forfeitedAcc = 0n;
  let keepAcc = 0n;
  const upd = db.prepare('UPDATE lots SET amount_raw=?, accrued_acc=?, claimed_acc=?, closed=? WHERE id=?');
  for (const lot of lots) {
    if (remaining <= 0n) break;
    const lotAmt = BigInt(lot.amount_raw);
    const take = lotAmt < remaining ? lotAmt : remaining;
    const accrued = BigInt(lot.accrued_acc);
    const claimed = BigInt(lot.claimed_acc);
    const removedAcc = (accrued * take) / lotAmt;
    const removedClaimed = (claimed * take) / lotAmt;
    const vestedRemoved = fracBig(removedAcc, lotUnlock(lot, Date.parse(ts)));
    let keep = vestedRemoved - removedClaimed;
    if (keep < 0n) keep = 0n;
    const forfeit = removedAcc - removedClaimed - keep;
    keepAcc += keep;
    forfeitedAcc += forfeit > 0n ? forfeit : 0n;
    const newAmt = lotAmt - take;
    upd.run((newAmt).toString(), (accrued - removedAcc).toString(), (claimed - removedClaimed).toString(), newAmt === 0n ? 1 : 0, lot.id);
    remaining -= take;
  }
  if (keepAcc > 0n) {
    db.prepare('UPDATE holders SET residual_acc = CAST((CAST(residual_acc AS INTEGER) + ?) AS TEXT) WHERE owner=?').run(keepAcc.toString(), owner);
  }
  return forfeitedAcc / ACC_SCALE;
}

export function runAccrualEpoch(snapshot: Map<string, bigint>) {
  const ts = now();
  db.exec('BEGIN');
  try {
    // 1. distribute hold_pending across open lots
    const holdIn = kvBig(LEDGER.holdPending);
    const openLots = db.prepare('SELECT id, amount_raw FROM lots WHERE closed=0').all() as unknown as { id: number; amount_raw: string }[];
    const eligible = openLots.reduce((s, l) => s + BigInt(l.amount_raw), 0n);
    let distributedAcc = 0n;
    if (holdIn > 0n && eligible > 0n) {
      const add = db.prepare('UPDATE lots SET accrued_acc = CAST((CAST(accrued_acc AS INTEGER) + ?) AS TEXT) WHERE id=?');
      const pool = holdIn * ACC_SCALE;
      for (const l of openLots) {
        const a = (pool * BigInt(l.amount_raw)) / eligible;
        if (a === 0n) continue;
        add.run(a.toString(), l.id);
        distributedAcc += a;
      }
      const distributed = distributedAcc / ACC_SCALE;
      kvAdd(LEDGER.holdPending, -distributed);
      kvAdd(LEDGER.holdOwed, distributed);
    }

    // 2. diff recorded balances vs snapshot
    const holders = db.prepare('SELECT * FROM holders').all() as unknown as HolderRow[];
    const prev = new Map(holders.map((h) => [h.owner, BigInt(h.balance_raw)]));
    const owners = new Set<string>([...prev.keys(), ...snapshot.keys()]);
    const upsert = db.prepare(
      'INSERT INTO holders(owner,balance_raw,residual_acc,updated_at) VALUES(?,?,?,?) ON CONFLICT(owner) DO UPDATE SET balance_raw=excluded.balance_raw, updated_at=excluded.updated_at',
    );
    const insLot = db.prepare('INSERT INTO lots(owner,amount_raw,opened_at) VALUES(?,?,?)');
    let forfeited = 0n;
    let count = 0;
    for (const o of owners) {
      const p = prev.get(o) ?? 0n;
      const c = snapshot.get(o) ?? 0n;
      if (c > 0n) count++;
      if (c === p) continue;
      if (!prev.has(o)) upsert.run(o, c.toString(), '0', ts);
      else upsert.run(o, c.toString(), '0', ts);
      if (c > p) insLot.run(o, (c - p).toString(), ts);
      else forfeited += consumeLots(o, p - c, ts);
    }
    if (forfeited > 0n) {
      kvAdd(LEDGER.holdPending, forfeited);
      kvAdd(LEDGER.holdOwed, -forfeited);
    }
    // record the eligible supply as of this snapshot (distribution above used the pre-diff lots)
    const eligibleNow = [...snapshot.values()].reduce((s, v) => s + v, 0n);
    db.prepare('INSERT INTO accrual_epochs(ts,hold_in_raw,forfeited_raw,eligible_supply_raw,holders_count) VALUES(?,?,?,?,?)').run(
      ts,
      (distributedAcc / ACC_SCALE).toString(),
      forfeited.toString(),
      eligibleNow.toString(),
      count,
    );
    kvSet(LEDGER.lastAccrualAt, ts);
    db.exec('COMMIT');
    L.info(`epoch ok: distributed ${distributedAcc / ACC_SCALE} raw, forfeited ${forfeited} raw, holders ${count}`);
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

export function holderView(owner: string) {
  const h = db.prepare('SELECT * FROM holders WHERE owner=?').get(owner) as unknown as HolderRow | undefined;
  const lots = (db.prepare('SELECT * FROM lots WHERE owner=? AND closed=0 ORDER BY opened_at ASC').all(owner) as unknown as LotRow[]).map((l) => {
    const unlock = lotUnlock(l);
    return {
      id: l.id,
      amountRaw: l.amount_raw,
      openedAt: l.opened_at,
      holdHours: hoursSince(l.opened_at),
      unlock,
      accruedRaw: (BigInt(l.accrued_acc) / ACC_SCALE).toString(),
      claimedRaw: (BigInt(l.claimed_acc) / ACC_SCALE).toString(),
      claimableRaw: (lotClaimableAcc(l) / ACC_SCALE).toString(),
    };
  });
  const residual = BigInt(h?.residual_acc ?? '0');
  const claimableAcc = lots.reduce((s, l) => s + BigInt(l.claimableRaw) * ACC_SCALE, 0n) + residual;
  const claims = db.prepare('SELECT * FROM claims WHERE owner=? ORDER BY id DESC LIMIT 50').all(owner);
  return {
    owner,
    balanceRaw: h?.balance_raw ?? '0',
    residualRaw: (residual / ACC_SCALE).toString(),
    accruedRaw: lots.reduce((s, l) => s + BigInt(l.accruedRaw), 0n).toString(),
    claimableRaw: (claimableAcc / ACC_SCALE).toString(),
    lots,
    claims,
  };
}

/** Mark amountRaw as claimed (residual first, then oldest lots). Call inside a transaction. */
export function markClaimed(owner: string, amountRaw: bigint) {
  let remaining = amountRaw * ACC_SCALE;
  const h = db.prepare('SELECT residual_acc FROM holders WHERE owner=?').get(owner) as unknown as { residual_acc: string } | undefined;
  const residual = BigInt(h?.residual_acc ?? '0');
  if (residual > 0n) {
    const take = residual < remaining ? residual : remaining;
    db.prepare('UPDATE holders SET residual_acc=? WHERE owner=?').run((residual - take).toString(), owner);
    remaining -= take;
  }
  const lots = db.prepare('SELECT * FROM lots WHERE owner=? AND closed=0 ORDER BY opened_at ASC').all(owner) as unknown as LotRow[];
  const upd = db.prepare('UPDATE lots SET claimed_acc=? WHERE id=?');
  for (const l of lots) {
    if (remaining <= 0n) break;
    const c = lotClaimableAcc(l);
    if (c <= 0n) continue;
    const take = c < remaining ? c : remaining;
    upd.run((BigInt(l.claimed_acc) + take).toString(), l.id);
    remaining -= take;
  }
  if (remaining > ACC_SCALE) throw new Error('insufficient claimable balance');
}
