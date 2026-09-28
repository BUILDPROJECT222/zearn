import type { VaultState } from '../api';

const I = {
  trade: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 17l6-6 4 4 8-8" /><path d="M14 7h7v7" /></svg>,
  sweep: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></svg>,
  swap: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7h13l-3-3" /><path d="M20 17H7l3 3" /></svg>,
  vault: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="12" cy="12" r="3" /><path d="M12 9v-2M12 17v-2" /></svg>,
  hold: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z" /></svg>,
};

export default function Pipeline({ s }: { s: VaultState | null }) {
  const split = s ? s.params.floorSplitBps / 100 : 50;
  const mins = Math.round((s?.params.sweepIntervalSec ?? 300) / 60);
  return (
    <div className="pipeline">
      <div className="pipe">
        <div className="ico">{I.trade}</div>
        <div className="n">01</div>
        <h3>Trades create fees</h3>
        <p>Every buy and sell on pump.fun or PumpSwap pays a creator fee: 0.30% on the bonding curve, up to 0.95% after graduation.</p>
      </div>
      <div className="pipe">
        <div className="ico">{I.sweep}</div>
        <div className="n">02</div>
        <h3>Keeper sweeps every {mins} min</h3>
        <p>Fees land in the vault wallet. Nothing is traded, nothing is held in SOL longer than one epoch.</p>
      </div>
      <div className="pipe">
        <div className="ico">{I.swap}</div>
        <div className="n">03</div>
        <h3>SOL → ZEC via NEAR Intents</h3>
        <p>1Click swaps SOL to ZEC. The ZEC stays in a public intents.near account anyone can audit.</p>
      </div>
      <div className="pipe floor-step">
        <div className="ico">{I.vault}</div>
        <div className="n">04 · {split}%</div>
        <h3>Floor Vault</h3>
        <p>Burn N tokens, receive N ÷ supply of the vault minus a {s ? s.params.redeemFeeBps / 100 : 2}% fee that stays behind. Redeem in-kind, no oracle.</p>
      </div>
      <div className="pipe hold-step">
        <div className="ico">{I.hold}</div>
        <div className="n">05 · {100 - split}%</div>
        <h3>Hold Pool</h3>
        <p>Accrues to holders pro-rata. Unlocks with lot age: 15 min = 5%, 8 h = 100%. Sell early and the rest goes back to the pool.</p>
      </div>
    </div>
  );
}
