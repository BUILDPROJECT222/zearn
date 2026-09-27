/**
 * DEV ONLY: seed the ledger with fake sweeps so the dashboard has data while DRY_RUN.
 * Run: npm run seed:dev   (refuses to run when DRY_RUN=false)
 */
import { config } from './config.js';
import { db, kvAdd, kvSet, LEDGER, now } from './db.js';

if (!config.dryRun) {
  console.error('seed-dev only runs with DRY_RUN=true');
  process.exit(1);
}
const zec = (x: number) => BigInt(Math.round(x * 10 ** config.zecDecimals));
const rows: [number, number][] = [
  [0.9, 0.0685],
  [1.4, 0.1066],
  [0.7, 0.0533],
  [1.1, 0.0838],
  [1.6, 0.1219],
  [1.2, 0.0914],
  [0.8, 0.0609],
  [1.9, 0.1447],
];
let floor = 0n;
let hold = 0n;
const ins = db.prepare('INSERT INTO sweeps(created_at,updated_at,sol_lamports,zec_raw,floor_raw,hold_raw,deposit_address,tx_sig,status) VALUES(?,?,?,?,?,?,?,?,?)');
rows.forEach(([sol, z], i) => {
  const ts = new Date(Date.now() - (rows.length - i) * config.sweepIntervalSec * 1000).toISOString();
  const total = zec(z);
  const f = (total * BigInt(config.floorSplitBps)) / 10_000n;
  const h = total - f;
  floor += f;
  hold += h;
  ins.run(ts, ts, String(Math.round(sol * 1e9)), total.toString(), f.toString(), h.toString(), 'seed', null, 'success');
});
kvAdd(LEDGER.floor, floor);
kvAdd(LEDGER.holdPending, hold);
kvSet(LEDGER.lastSweepAt, now());
console.log(`seed: +${Number(floor) / 1e8} ZEC floor, +${Number(hold) / 1e8} ZEC hold pending`);
