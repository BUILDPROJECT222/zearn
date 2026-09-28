// Generates the Solana vault wallet (receives pump.fun creator fees) and saves the secret to
// apps/backend/secrets/solana-vault.env as base58. Prints ONLY the public address.
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, '../secrets/solana-vault.env');
if (existsSync(out)) {
  console.error(`refusing to overwrite ${out}; move it away first`);
  process.exit(1);
}
const kp = Keypair.generate();
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `# public address: ${kp.publicKey.toBase58()}\nVAULT_SOL_SECRET=${bs58.encode(kp.secretKey)}\n`, { mode: 0o600 });
console.log(`VAULT address: ${kp.publicKey.toBase58()}`);
console.log(`secret key saved to ${out} (not printed)`);
