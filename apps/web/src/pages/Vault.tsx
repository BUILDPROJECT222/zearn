import type { Data } from '../App';
import Stats from '../components/Stats';
import Charts from '../components/Charts';
import StressTest from '../components/StressTest';

export default function VaultPage({ d }: { d: Data }) {
  return (
    <>
      <div className="eyebrow">Live treasury</div>
      <h1 className="title">Backed by ZEC you can <em>verify.</em></h1>
      <p className="lead">Every number comes from the chain and the protocol ledger. The treasury balance sits in a public NEAR Intents account.</p>
      <div className="gap-lg" />
      <Stats s={d.s} sweeps={d.sweeps} />
      <div className="gap" />
      <Charts s={d.s} sweeps={d.sweeps} />
      <div className="gap-lg" />
      <div className="eyebrow">Stress test</div>
      <h2 className="title" style={{ fontSize: 28 }}>What happens when the price dumps?</h2>
      <p className="lead">Drag the market cap and watch the floor do its job.</p>
      <div className="gap" />
      <StressTest s={d.s} />
    </>
  );
}
