// Generates a NEAR implicit account (64-hex id) and saves the key to apps/backend/secrets/near-treasury.env.
// Prints ONLY the account id. Fund the id with ~1 NEAR and it becomes active; then copy the .env lines into Railway.
import { KeyPair } from 'near-api-js';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, '../secrets/near-treasury.env');
if (existsSync(out)) {
  console.error(`refusing to overwrite ${out}; move it away first`);
  process.exit(1);
}
const kp = KeyPair.fromRandom('ed25519');
const accountId = Buffer.from(kp.getPublicKey().data).toString('hex');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `NEAR_ACCOUNT_ID=${accountId}\nNEAR_PRIVATE_KEY=${kp.toString()}\n`, { mode: 0o600 });
console.log(`NEAR_ACCOUNT_ID=${accountId}`);
console.log(`private key saved to ${out} (not printed)`);
