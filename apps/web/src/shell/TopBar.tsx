import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { ago, usd, type VaultState } from '../api';
import XLink from '../components/XLink';

export default function TopBar({ s }: { s: VaultState | null }) {
  const items: [string, string][] = s
    ? [
        ['MCAP', usd(s.market?.marketCapUsd ?? null)],
        ['FLOOR', usd(s.floorMcUsd)],
        ['VAULT', `${s.floorZec.toFixed(4)} ZEC`],
        ['HOLD POOL', `${(s.holdPendingZec + s.holdOwedZec).toFixed(4)} ZEC`],
        ['ZEC', usd(s.prices.zec, 0)],
        ['SOL', usd(s.prices.sol, 2)],
        ['VOL 24H', usd(s.market?.volume24h ?? null)],
        ['SWEEP', ago(s.lastSweepAt)],
        ['FEE', `${s.params.redeemFeeBps / 100}%`],
      ]
    : [['STATUS', 'connecting…']];
  return (
    <header className="topbar">
      <div className="stats">
        {items.map(([k, v]) => (
          <span key={k}>{k}<b>{v}</b></span>
        ))}
      </div>
      <XLink handle={s?.links?.x} />
      <WalletMultiButton />
    </header>
  );
}
