import type { VaultState } from '../api';

export default function Verify({ s }: { s: VaultState | null }) {
  const split = s ? s.params.floorSplitBps / 100 : 50;
  const treasury = s ? s.params.treasuryShareBps / 100 : 90;
  const ops = 100 - treasury;
  const dry = s?.dryRun ?? true;
  const near = s?.intentsBalanceZec !== null && s?.intentsBalanceZec !== undefined;
  return (
    <div className="panel corner">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2>Verify before you trust</h2>
          <div className="sub" style={{ margin: 0 }}>What a buyer can check about $ZEARN, and what is still a promise in v1.</div>
        </div>
        <span className={`tag ${dry ? 'warn' : ''}`}>{dry ? 'dry run · simulated' : 'live'}</span>
      </div>
      <div className="split">
        <div style={{ width: `${(treasury * split) / 100}%`, background: 'var(--gold)' }} />
        <div style={{ width: `${(treasury * (100 - split)) / 100}%`, background: 'var(--green)' }} />
        <div style={{ width: `${ops}%`, background: 'var(--purple)' }} />
      </div>
      <div className="legend">
        <span className="mono muted">100% of creator fee →</span>
        <span><i style={{ background: 'var(--gold)' }} />Floor Vault {(treasury * split) / 100}%</span>
        <span><i style={{ background: 'var(--green)' }} />Hold Pool {(treasury * (100 - split)) / 100}%</span>
        <span><i style={{ background: 'var(--purple)' }} />Ops {ops}%</span>
      </div>
      <div className="checks">
        <div className="check">
          <div className="n">1</div>
          <div>
            <b>Fees go to the vault wallet</b>
            <p>pump.fun creator fees are routed to the keeper's vault wallet. Anyone can watch that address on Solscan and compare inflows with the sweeps in the ledger.</p>
            <div className="state ok">on-chain · solscan</div>
          </div>
        </div>
        <div className="check">
          <div className="n">2</div>
          <div>
            <b>The ZEC balance is public</b>
            <p>The treasury holds ZEC as <span className="mono">nep141:zec.omft.near</span> inside intents.near. One view call, <span className="mono">mt_batch_balance_of</span>, returns the exact amount.</p>
            <div className={`state ${near ? 'ok' : 'todo'}`}>{near ? `near view · ${s!.intentsBalanceZec!.toFixed(4)} ZEC` : 'near account not configured yet'}</div>
          </div>
        </div>
        <div className="check">
          <div className="n">3</div>
          <div>
            <b>Redeems are in-kind and pro-rata</b>
            <p>Burn N tokens, receive N ÷ supply of the vault minus {s ? s.params.redeemFeeBps / 100 : 2}%. No price oracle, nothing to manipulate. Every redeem is listed with its burn signature.</p>
            <div className="state ok">formula · ledger</div>
          </div>
        </div>
        <div className="check">
          <div className="n">4</div>
          <div>
            <b>Hold rewards cannot be farmed</b>
            <p>Lots are timestamped on-chain balance changes. A 15-minute flip unlocks 5% of 15 minutes of accrual, always less than the round-trip fee. Early sells forfeit to the pool.</p>
            <div className="state ok">indexer · epochs</div>
          </div>
        </div>
        <div className="check">
          <div className="n">5</div>
          <div>
            <b>Keeper keys are the trust assumption</b>
            <p>v1 is custodial: a hot wallet on Solana and a NEAR account sign the swaps and payouts. v2 moves the vault to NEAR Chain Signatures and runs the keeper inside a TEE with public attestation.</p>
            <div className="state todo">v1 · custodial</div>
          </div>
        </div>
        <div className="check">
          <div className="n">6</div>
          <div>
            <b>Payouts never touch our own bridge code</b>
            <p>Every payout is a NEAR Intents 1Click order funded from the treasury balance: ZEC→SOL, ZEC→ZEC on Solana, ZEC→USDC, ZEC→NEAR, or ZEC→Zcash (transparent t-address). The 1Click deposit address and NEAR tx hash are stored with each payout.</p>
            <div className="state ok">1click · verified with dry quotes</div>
          </div>
        </div>
      </div>
      <div className="footnote">{dry ? 'Dry run: quotes are real, transfers are not. Every row above becomes a contract read once the keeper goes live.' : 'Live: every row above is a contract read or a signed transaction.'}</div>
    </div>
  );
}
