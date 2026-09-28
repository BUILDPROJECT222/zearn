import type { Data } from '../App';

const RISKS: [string, string][] = [
  ['Custody in v1', 'The keeper holds a Solana hot wallet and a NEAR account. If those keys are lost or misused, the vault is at risk. Mitigation: public balances, a public ledger, and a roadmap to Chain Signatures and a TEE keeper.'],
  ['ZEC volatility', 'The floor is denominated in ZEC. When ZEC drops, the USD floor drops with it. When ZEC pumps, so does the floor. This is a feature and a risk.'],
  ['Thin floor early on', 'In the first hours the vault backs only a few percent of market cap. The floor is a safety net far below the price, not a reason to expect the price to hold.'],
  ['No private payouts', 'Payouts are visible on Solana, NEAR and the bridge, and ZEC arrives at transparent addresses only. If you want privacy, shield the ZEC yourself after it lands.'],
  ['Bridge dependency', 'Swaps and payouts run through NEAR Intents. Delays, minimum sizes or refunds on that side delay redeems and claims.'],
  ['Indexer edge cases', 'Moving tokens between your own wallets resets the lot clock. Undetected pool or program accounts could distort eligible supply until excluded.'],
  ['pump.fun fee routing', 'Automation of creator-fee claiming, especially after graduation to PumpSwap, is not fully verified. Manual claiming may be needed.'],
  ['Regulation', 'A token with a redeemable reserve and holding-based rewards may be treated as a financial product in some jurisdictions. Check your local rules.'],
];

export default function RisksPage({ d }: { d: Data }) {
  return (
    <>
      <div className="eyebrow">Risks & terms</div>
      <h1 className="title">Know what you are <em>buying.</em></h1>
      <p className="lead">This is an experiment. Nothing here is investment advice or a promise of return. Read this page before you trade.</p>
      <div className="gap-lg" />
      <div className="risks">
        {RISKS.map(([t, p]) => (
          <div className="risk" key={t}><b>{t}</b><p>{p}</p></div>
        ))}
      </div>
      <div className="gap-lg" />
      <div className="panel">
        <h2>Terms in one breath</h2>
        <p className="muted" style={{ fontSize: 13 }}>
          Zearn is an experimental protocol and $ZEARN is a memecoin. Redeems are paid from whatever ZEC the vault holds at the moment your burn is processed, pro-rata to supply, minus the redeem fee. Hold rewards are paid from whatever the Hold Pool received while you held, subject to the unlock curve. The team can change parameters (split, fee, unlock curve) and will announce changes in the ledger before they apply. Simulation figures on this site are assumptions, not projections. You are responsible for your own taxes and for complying with the laws that apply to you.
        </p>
        <div className="footnote">Mode: {d.s?.dryRun ? 'DRY RUN. Quotes are real, transfers are simulated.' : 'LIVE.'}</div>
      </div>
    </>
  );
}
