import { config } from './config.js';
import { runAccrualEpoch } from './holdpool.js';
import { retryPendingRedeems } from './jobs/redeem.js';
import { scanBurnsOnce } from './jobs/scanner.js';
import { sweepOnce } from './jobs/sweep.js';
import { log } from './log.js';
import { buildServer } from './server.js';
import { snapshotHolders } from './solana.js';

const L = log('main');

async function loop(name: string, fn: () => Promise<void>, everyMs: number) {
  for (;;) {
    try {
      await fn();
    } catch (e) {
      L.error(`${name}:`, (e as Error).message);
    }
    await new Promise((r) => setTimeout(r, everyMs));
  }
}

async function main() {
  const app = buildServer();
  await app.listen({ port: config.port, host: '0.0.0.0' });
  L.info(`API http://localhost:${config.port}  dryRun=${config.dryRun}  mint=${config.mint || '(not set)'}`);

  if (!config.mint) {
    L.warn('ZEARN_MINT is empty: keeper disabled, API only');
    return;
  }
  if (config.vaultSolSecret) {
    void loop('sweep', sweepOnce, config.sweepIntervalSec * 1000);
  } else {
    L.warn('VAULT_SOL_SECRET is empty: sweep disabled');
  }
  void loop(
    'accrual',
    async () => {
      const snap = await snapshotHolders();
      runAccrualEpoch(snap);
    },
    config.sweepIntervalSec * 1000,
  );
  void loop('redeem-retry', retryPendingRedeems, 30_000);
  if (config.burnScanEnabled) void loop('burn-scan', scanBurnsOnce, config.burnScanIntervalSec * 1000);
}

main().catch((e) => {
  L.error(e);
  process.exit(1);
});
