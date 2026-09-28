import { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { api, curveText, hours, short, tok, zec, type HolderView, type VaultState } from '../api';
import { DEST_OPTIONS, destFor, destValid, optionFor, type DestKind } from '../dest';

export default function HoldCard({ s, onDone }: { s: VaultState | null; onDone: () => void }) {
  const { publicKey, signMessage } = useWallet();
  const [view, setView] = useState<HolderView | null>(null);
  const [kind, setKind] = useState<DestKind>('SOL');
  const [zaddr, setZaddr] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const decimals = s?.tokenDecimals ?? 6;
  const load = () => publicKey && api.holder(publicKey.toBase58()).then(setView).catch(() => setView(null));
  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [publicKey]);

  const claimable = Number(view?.claimableRaw ?? 0) / 1e8;
  const min = s ? Math.max(s.params.minClaimZec, s.prices.zec > 0 ? s.params.minClaimUsd / s.prices.zec : 0) : 0;
  const dest = destFor(kind, publicKey?.toBase58(), zaddr);
  const can = !!publicKey && !!signMessage && claimable >= min && claimable > 0 && !busy && destValid(kind, publicKey?.toBase58(), zaddr);

  async function claim() {
    if (!publicKey || !signMessage) return;
    setMsg(null);
    try {
      setBusy('Preparing message…');
      const owner = publicKey.toBase58();
      const p = await api.claimPrepare(owner, kind, dest);
      setBusy('Sign the message in your wallet (free, not a transaction)…');
      const sig = await signMessage(new TextEncoder().encode(p.message));
      setBusy('Submitting claim…');
      const c = await api.submitClaim({ owner, destKind: kind, destAddr: dest, nonce: p.nonce, issued: p.issued, signature: btoa(String.fromCharCode(...sig)) });
      setMsg({ ok: true, text: `Claim #${c.id} for ${zec(c.amount_raw)} ZEC ${c.status === 'dry' ? 'recorded' : c.status}` });
      await load();
      onDone();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="card">
      <h2>Hold rewards, no burn required</h2>
      <p className="sub">
        Hold Pool ZEC accrues to every holder pro-rata each epoch and unlocks with lot age: {curveText(s?.params.vestCurve)}. Sell early and the locked part goes back to the pool.
      </p>

      {!publicKey ? (
        <div className="note">Connect a wallet to see your accrual and unlock progress.</div>
      ) : !view ? (
        <div className="note">Loading…</div>
      ) : (
        <>
          <div className="preview">
            <div><span>Recorded balance (last snapshot)</span><b>{tok(view.balanceRaw, decimals)} ZEARN</b></div>
            <div><span>Total accrued</span><b>{zec(view.accruedRaw)} ZEC</b></div>
            <div><span>Claimable now</span><b className="gold">{zec(view.claimableRaw)} ZEC{s ? ` ≈ $${(claimable * s.prices.zec).toFixed(2)}` : ''}</b></div>
          </div>

          {view.lots.length > 0 && (
            <div className="tbl" style={{ marginTop: 12 }}>
              <table>
                <thead><tr><th>Lot</th><th className="num">Tokens</th><th>Held</th><th>Unlocked</th><th className="num">Accrued</th><th className="num">Claimable</th></tr></thead>
                <tbody>
                  {view.lots.map((l) => (
                    <tr key={l.id}>
                      <td className="mono">#{l.id}</td>
                      <td className="num">{tok(l.amountRaw, decimals)}</td>
                      <td>{hours(l.holdHours)}</td>
                      <td>
                        {(l.unlock * 100).toFixed(0)}%
                        <div className="bar"><div style={{ width: `${l.unlock * 100}%` }} /></div>
                      </td>
                      <td className="num">{zec(l.accruedRaw)}</td>
                      <td className="num gold">{zec(l.claimableRaw)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="row">
            <div>
              <label>Receive as</label>
              <select value={kind} onChange={(e) => setKind(e.target.value as DestKind)}>
            {DEST_OPTIONS.map((o) => (
              <option key={o.kind} value={o.kind}>{o.label}</option>
            ))}
          </select>
            </div>
            <div>
              <label>{optionFor(kind).input?.label ?? 'Destination'}</label>
              {optionFor(kind).input ? (
                <input placeholder={optionFor(kind).input!.placeholder} value={zaddr} onChange={(e) => setZaddr(e.target.value)} />
              ) : (
                <input disabled value={short(publicKey.toBase58(), 6)} />
              )}
            </div>
          </div>
          <div className="note" style={{ marginTop: 6 }}>{optionFor(kind).hint}</div>
          <button className="primary" disabled={!can} onClick={claim}>
            {busy ?? (claimable < min ? `Minimum claim is ${min.toFixed(5)} ZEC (≈ $${s?.params.minClaimUsd ?? 5})` : `Claim ${zec(view.claimableRaw)} ZEC`)}
          </button>
          {msg && <div className={`note ${msg.ok ? 'ok' : 'bad'}`}>{msg.text}</div>}
          <div className="note">Claiming only needs a signed message; your tokens never leave the wallet. Accrual runs every epoch (about {Math.round((s?.params.sweepIntervalSec ?? 300) / 60)} minutes).</div>

          {view.claims.length > 0 && (
            <div className="tbl" style={{ marginTop: 14 }}>
              <table>
                <thead><tr><th>Claim</th><th className="num">ZEC</th><th>To</th><th>Status</th></tr></thead>
                <tbody>
                  {view.claims.map((c) => (
                    <tr key={c.id}>
                      <td className="mono">#{c.id}</td>
                      <td className="num">{zec(c.amount_raw)}</td>
                      <td className="mono">{c.dest_kind} {short(c.dest_addr)}</td>
                      <td><span className={`status ${c.status}`}>{c.status}</span>{c.error && <div className="note">{c.error}</div>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
