import type { Data } from '../App';
import HoldCard from '../components/HoldCard';
import { UnlockCurve } from '../components/Charts';

export default function HoldPage({ d }: { d: Data }) {
  const { s } = d;
  return (
    <>
      <div className="eyebrow">Hold Pool</div>
      <h1 className="title">Hold longer, <em>unlock more.</em></h1>
      <p className="lead">Half of every sweep accrues to holders pro-rata. Each buy opens a lot with its own clock. Sell early and the locked part goes back to everyone else.</p>
      <div className="gap-lg" />
      <div className="panel-grid">
        <HoldCard s={s} onDone={d.refresh} />
        <aside className="side">
          <UnlockCurve curve={s?.params.vestCurve ?? [[0, 0], [0.25, 0.05], [0.5, 0.1], [1, 0.2], [2, 0.35], [4, 0.6], [6, 0.8], [8, 1]]} compact />
        </aside>
      </div>
    </>
  );
}
