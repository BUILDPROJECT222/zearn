import type { Data } from '../App';
import { usd } from '../api';
import RedeemCard from '../components/RedeemCard';

export default function RedeemPage({ d }: { d: Data }) {
  const { s } = d;
  return (
    <>
      <div className="eyebrow" style={{ color: 'var(--red)' }}>Emergency exit</div>
      <h1 className="title">If it dumps, <em>you still leave with ZEC.</em></h1>
      <p className="lead">This is the safety net, not the main door. Use it when the market price has fallen below the ZEC floor. One transaction: burn plus a memo with your destination. Every burn leaves its {s ? s.params.redeemFeeBps / 100 : 2}% fee in the vault, so the floor per token ticks up slightly for everyone who stays.</p>
      <div className="gap-lg" />
      <div className="panel-grid">
        <RedeemCard s={s} onDone={d.refresh} />
        <aside className="side">
          <div className="card">
            <h2 style={{ fontSize: 15 }}>Right now</h2>
            <p className="sub">Parameters used for every calculation.</p>
            <dl>
              <dt>Floor Vault</dt><dd>{s ? `${s.floorZec.toFixed(5)} ZEC` : '–'}</dd>
              <dt>Circulating supply</dt><dd>{s ? s.supply.toLocaleString('en-US', { maximumFractionDigits: 0 }) : '–'}</dd>
              <dt>Floor per token</dt><dd>{s ? s.floorPerTokenZec.toExponential(3) : '–'}</dd>
              <dt>Redeem fee</dt><dd>{s ? `${s.params.redeemFeeBps / 100}%` : '–'}</dd>
              <dt>Min redeem</dt><dd>{s ? `${s.params.minRedeemTokens.toLocaleString('en-US')}` : '–'}</dd>
              <dt>ZEC price</dt><dd>{usd(s?.prices.zec ?? null, 2)}</dd>
              <dt>Arb gap</dt><dd className={s?.arbGapPct != null && s.arbGapPct > 0 ? 'green' : ''}>{s && s.floorZec <= 0 ? 'no floor yet' : s?.arbGapPct == null ? '–' : `${s.arbGapPct.toFixed(1)}%`}</dd>
            </dl>
            <div className="note">Redeems pay in-kind from the vault, so they cannot be manipulated through a price oracle. The fee stays in the vault and lifts the floor for everyone who remains.</div>
          </div>
        </aside>
      </div>
    </>
  );
}
