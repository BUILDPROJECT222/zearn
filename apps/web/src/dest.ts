/** Payout destinations shared by the redeem and hold-claim forms */
export type DestKind = 'SOL' | 'ZECSOL' | 'USDC' | 'ZEC' | 'NEAR';

export type DestOption = { kind: DestKind; label: string; hint: string; input?: { label: string; placeholder: string; valid: (a: string) => boolean } };

export const isZcashAddress = (a: string) => /^(t[13][1-9A-HJ-NP-Za-km-z]{33}|u1[02-9ac-hj-np-z]{40,})$/.test(a.trim());
export const isNearAccount = (a: string) => /^([a-z0-9]+([-_.][a-z0-9]+)*\.(near|tg)|[0-9a-f]{64})$/.test(a.trim());

export const DEST_OPTIONS: DestOption[] = [
  { kind: 'SOL', label: 'SOL to this wallet', hint: 'ZEC swapped to SOL through NEAR Intents (~10 s)' },
  { kind: 'ZECSOL', label: 'ZEC (SPL) to this wallet', hint: 'ZEC token on Solana (~10 s)' },
  { kind: 'USDC', label: 'USDC to this wallet', hint: 'ZEC swapped to USDC on Solana (~10 s)' },
  { kind: 'ZEC', label: 'ZEC to a Zcash address', hint: 'transparent t1…/t3… or unified u1… (~2 min, bridge fee ≈ 0.0003 ZEC)', input: { label: 'Zcash address (t1… / u1…)', placeholder: 'u1… or t1…', valid: isZcashAddress } },
  { kind: 'NEAR', label: 'NEAR to a NEAR account', hint: 'ZEC swapped to native NEAR (~10 s)', input: { label: 'NEAR account', placeholder: 'yourname.near', valid: isNearAccount } },
];

export const optionFor = (kind: DestKind) => DEST_OPTIONS.find((o) => o.kind === kind) ?? DEST_OPTIONS[0];
export const destFor = (kind: DestKind, wallet: string | undefined, addr: string) => (optionFor(kind).input ? addr.trim() : wallet ?? '');
export const destValid = (kind: DestKind, wallet: string | undefined, addr: string) => {
  const o = optionFor(kind);
  return o.input ? o.input.valid(addr) : !!wallet;
};
