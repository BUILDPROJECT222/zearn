import type { VaultState } from '../api';

export default function FAQ({ s }: { s: VaultState | null }) {
  const fee = s ? s.params.redeemFeeBps / 100 : 2;
  return (
    <div className="faq">
      <details open>
        <summary>Can the price really not go to zero?</summary>
        <p>Every token is redeemable for its share of the ZEC vault. If the market price falls below that share, buying and burning is instantly profitable, so bots push it back. The floor moves with the ZEC price and grows with volume. It is a safety net, not a pump engine.</p>
      </details>
      <details>
        <summary>What do I get if I burn?</summary>
        <p>Your share of the Floor Vault: burned ÷ circulating supply × vault ZEC, minus a {fee}% fee that stays in the vault for everyone else. Paid to a transparent Zcash address or swapped to SOL through NEAR Intents.</p>
      </details>
      <details>
        <summary>How do hold rewards work?</summary>
        <p>Half of every sweep goes into the Hold Pool and accrues to holders pro-rata every epoch. Each buy opens a lot with its own clock. Rewards unlock as the lot ages: 5% after 15 minutes, 100% after 8 hours. Selling a lot early forfeits its locked part back to the pool.</p>
      </details>
      <details>
        <summary>Do I need to burn to claim hold rewards?</summary>
        <p>No. Claiming is a signed message, not a transaction. Your tokens stay in your wallet and keep accruing.</p>
      </details>
      <details>
        <summary>Where is the ZEC and who controls it?</summary>
        <p>The ZEC sits as a balance inside the intents.near contract under the treasury account, visible to anyone. In v1 the keeper holds the keys, so you trust the team; every sweep, redeem and claim is logged on this page. v2 moves the vault to NEAR Chain Signatures and a TEE keeper.</p>
      </details>
      <details>
        <summary>Where can I receive my ZEC?</summary>
        <p>Five ways: SOL, the ZEC SPL token or USDC in your Solana wallet, native NEAR to a NEAR account, or native ZEC to a transparent Zcash address (t1…/t3…). The Zcash route takes about two minutes and costs about 0.0003 ZEC in bridge fees. Payouts are not shielded; shield them yourself after arrival.</p>
      </details>
      <details>
        <summary>Does redeeming raise the floor for others?</summary>
        <p>Only by the {fee}% fee. Redeems are pro-rata, so the vault and the supply shrink by the same fraction. The floor rises from new volume, ZEC appreciation and accumulated fees.</p>
      </details>
      <details>
        <summary>Which tokens earn hold rewards?</summary>
        <p>Tokens in regular wallets. Tokens sitting in the bonding curve, AMM pools or program accounts are excluded, so the eligible supply is smaller than the total and each holder's share is larger.</p>
      </details>
    </div>
  );
}
