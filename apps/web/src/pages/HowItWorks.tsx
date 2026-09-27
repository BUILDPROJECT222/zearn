import type { Data } from '../App';
import Pipeline from '../components/Pipeline';
import FAQ from '../components/FAQ';
import FlowDiagram from '../components/FlowDiagram';

export default function HowItWorksPage({ d }: { d: Data }) {
  const { s } = d;
  const fee = s ? s.params.redeemFeeBps / 100 : 2;
  return (
    <>
      <div className="eyebrow">Mechanism</div>
      <h1 className="title">From trade to floor <em>in five steps.</em></h1>
      <p className="lead">No trading desk, no yield farming, no APY promises. Fees in, ZEC out, split between a hard floor and hold rewards.</p>
      <Pipeline s={s} />

      <div className="gap-lg" />
      <div className="eyebrow">Full flow</div>
      <h2 className="title" style={{ fontSize: 28 }}>Fees in, ZEC out, three loops.</h2>
      <div className="gap" />
      <FlowDiagram s={s} />

      <div className="gap-lg" />
      <div className="three">
        <div className="panel corner">
          <div className="eyebrow">Worked example · redeem</div>
          <h3>You hold 2% of supply, the vault has 10 ZEC</h3>
          <div className="preview">
            <div><span>Your share</span><b>10 × 2% = 0.2 ZEC</b></div>
            <div><span>Redeem fee {fee}%</span><b>− {(0.2 * fee) / 100} ZEC</b></div>
            <div><span>You receive</span><b className="gold">{(0.2 * (1 - fee / 100)).toFixed(3)} ZEC</b></div>
          </div>
          <div className="note">Your 20M tokens are burned. Holding time does not matter here.</div>
        </div>
        <div className="panel corner">
          <div className="eyebrow">Worked example · hold</div>
          <h3>Same 2%, 10 ZEC flows into the pool while you hold</h3>
          <div className="preview">
            <div><span>Eligible share (÷ 70% in wallets)</span><b>2.86%</b></div>
            <div><span>Accrued over the day</span><b>0.286 ZEC</b></div>
            <div><span>Held &gt; 8 h → unlock</span><b className="green">100%</b></div>
          </div>
          <div className="note">Tokens stay in your wallet. Only ZEC that arrived after you bought counts.</div>
        </div>
        <div className="panel corner">
          <div className="eyebrow">Worked example · flip</div>
          <h3>Buy and sell inside 15 minutes</h3>
          <div className="preview">
            <div><span>Unlock at 15 min</span><b>5%</b></div>
            <div><span>Reward on a $500 position</span><b>≈ $0.06</b></div>
            <div><span>Round-trip fees</span><b className="bad">≈ $12</b></div>
          </div>
          <div className="note">Farming loses money by construction. The forfeited 95% goes back to the pool.</div>
        </div>
      </div>

      <div className="gap-lg" />
      <div className="eyebrow">FAQ</div>
      <h2 className="title" style={{ fontSize: 28 }}>Straight answers.</h2>
      <div className="gap" />
      <FAQ s={s} />
    </>
  );
}
