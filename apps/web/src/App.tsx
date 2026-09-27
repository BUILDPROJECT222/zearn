import { useEffect, useState } from 'react';
import { api, type Accrual, type Claim, type Redeem, type Sweep, type VaultState } from './api';
import Sidebar, { type PageId } from './shell/Sidebar';
import TopBar from './shell/TopBar';
import HQ from './pages/HQ';
import VaultPage from './pages/Vault';
import RedeemPage from './pages/Redeem';
import HoldPage from './pages/Hold';
import HowItWorksPage from './pages/HowItWorks';
import LedgerPage from './pages/Ledger';
import RisksPage from './pages/Risks';

export type Data = { s: VaultState | null; sweeps: Sweep[]; accruals: Accrual[]; redeems: Redeem[]; claims: Claim[]; err: string | null; refresh: () => void; go: (p: PageId) => void };

const PAGES: PageId[] = ['hq', 'vault', 'redeem', 'hold', 'how', 'ledger', 'risks'];
const fromHash = (): PageId => {
  const h = window.location.hash.replace(/^#\/?/, '') as PageId;
  return PAGES.includes(h) ? h : 'hq';
};

export default function App() {
  const [page, setPage] = useState<PageId>(fromHash);
  const [s, setS] = useState<VaultState | null>(null);
  const [sweeps, setSweeps] = useState<Sweep[]>([]);
  const [accruals, setAccruals] = useState<Accrual[]>([]);
  const [redeems, setRedeems] = useState<Redeem[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);
  const go = (p: PageId) => {
    window.location.hash = `/${p}`;
    setPage(p);
    window.scrollTo(0, 0);
  };

  useEffect(() => {
    const onHash = () => {
      setPage(fromHash());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    let alive = true;
    api.state().then((x) => alive && (setS(x), setErr(null))).catch((e) => alive && setErr((e as Error).message));
    api.sweeps(200).then((x) => alive && setSweeps(x)).catch(() => {});
    api.accruals().then((x) => alive && setAccruals(x)).catch(() => {});
    api.redeems().then((x) => alive && setRedeems(x)).catch(() => {});
    api.claims().then((x) => alive && setClaims(x)).catch(() => {});
    const id = setInterval(refresh, 15_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [tick]);

  const d: Data = { s, sweeps, accruals, redeems, claims, err, refresh, go };
  return (
    <div className="shell">
      <Sidebar page={page} go={go} d={d} />
      <div>
        <TopBar s={s} />
        <main className="content">
          {err && (
            <div className="panel" style={{ marginBottom: 14 }}>
              <b className="bad">Backend unreachable:</b> {err}
              <div className="note">Start it with <span className="mono">npm run dev:backend</span> and check VITE_API_URL.</div>
            </div>
          )}
          <div className="page" key={page}>
            {page === 'hq' && <HQ d={d} />}
            {page === 'vault' && <VaultPage d={d} />}
            {page === 'redeem' && <RedeemPage d={d} />}
            {page === 'hold' && <HoldPage d={d} />}
            {page === 'how' && <HowItWorksPage d={d} />}
            {page === 'ledger' && <LedgerPage d={d} />}
            {page === 'risks' && <RisksPage d={d} />}
          </div>
        </main>
      </div>
    </div>
  );
}
