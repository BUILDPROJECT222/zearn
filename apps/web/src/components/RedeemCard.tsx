import { useEffect, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';
import { createBurnCheckedInstruction, getAssociatedTokenAddressSync } from '@solana/spl-token';
import { Buffer } from 'buffer';
import { api, short, tok, zec, type Redeem, type VaultState } from '../api';
import { DEST_OPTIONS, destFor, destValid, optionFor, type DestKind } from '../dest';

const MEMO_PROGRAM = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

export default function RedeemCard({ s, onDone }: { s: VaultState | null; onDone: () => void }) {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const [amount, setAmount] = useState('');
  const [kind, setKind] = useState<DestKind>('SOL');
  const [zaddr, setZaddr] = useState('');
  const [preview, setPreview] = useState<{ payout: string; fee: string; belowMin: boolean } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [mine, setMine] = useState<Redeem[]>([]);
  const [balance, setBalance] = useState<number | null>(null);

  const decimals = s?.tokenDecimals ?? 6;
  const n = parseFloat(amount) || 0;

  useEffect(() => {
    if (!n || !s) return setPreview(null);
    const t = setTimeout(() => api.redeemPreview(n).then(setPreview).catch(() => setPreview(null)), 250);
    return () => clearTimeout(t);
  }, [n, s?.floorRaw]);

  const loadMine = () => publicKey && api.redeems(publicKey.toBase58()).then(setMine).catch(() => {});
  useEffect(() => {
    loadMine();
    if (!publicKey || !s?.mint) return setBalance(null);
    connection
      .getTokenAccountBalance(getAssociatedTokenAddressSync(new PublicKey(s.mint), publicKey))
      .then((b) => setBalance(b.value.uiAmount ?? 0))
      .catch(() => setBalance(0));
  }, [publicKey, s?.mint]);

  useEffect(() => {
    if (!mine.some((r) => r.status === 'pending' || r.status === 'paying')) return;
    const id = setInterval(loadMine, 8000);
    return () => clearInterval(id);
  }, [mine]);

  const dest = destFor(kind, publicKey?.toBase58(), zaddr);
  const canBurn = !!publicKey && !!s?.mint && n > 0 && !busy && destValid(kind, publicKey?.toBase58(), zaddr);

  async function burn() {
    if (!publicKey || !s) return;
    setErr(null);
    try {
      const mint = new PublicKey(s.mint);
      const ata = getAssociatedTokenAddressSync(mint, publicKey);
      const raw = BigInt(Math.floor(n * 10 ** decimals));
      const memo = `${s.params.memoPrefix}:${kind}:${dest}`;
      const tx = new Transaction().add(
        createBurnCheckedInstruction(ata, mint, publicKey, raw, decimals),
        new TransactionInstruction({ keys: [], programId: MEMO_PROGRAM, data: Buffer.from(memo, 'utf8') }),
      );
      setBusy('Waiting for wallet signature…');
      const sig = await sendTransaction(tx, connection);
      setBusy('Waiting for Solana confirmation…');
      const bh = await connection.getLatestBlockhash();
      await connection.confirmTransaction({ signature: sig, ...bh }, 'confirmed');
      setBusy('Registering the redeem with the vault…');
      await api.submitRedeem(sig);
      setAmount('');
      await loadMine();
      onDone();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="card">
      <h2>Burn $ZEARN, receive ZEC</h2>
      <p className="sub">Your pro-rata share of the Floor Vault, minus a {s ? s.params.redeemFeeBps / 100 : 2}% fee that stays in the vault for everyone else.</p>

      <label>
        Amount of $ZEARN{' '}
        {balance !== null && (
          <span className="gold" style={{ cursor: 'pointer' }} onClick={() => setAmount(String(balance))}>
            · balance {balance.toLocaleString('en-US')} (max)
          </span>
        )}
      </label>
      <input type="number" min="0" placeholder={`min. ${s?.params.minRedeemTokens ?? 1000}`} value={amount} onChange={(e) => setAmount(e.target.value)} />
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
            <input disabled value={publicKey ? short(publicKey.toBase58(), 6) : 'connect a wallet'} />
          )}
        </div>
      </div>
      <div className="note" style={{ marginTop: 6 }}>{optionFor(kind).hint}</div>

      {preview && (
        <div className="preview">
          <div><span>You receive</span><b className="gold">{zec(preview.payout)} ZEC</b></div>
          <div><span>Worth</span><b>{s ? `$${((Number(preview.payout) / 1e8) * s.prices.zec).toFixed(2)}` : '–'}</b></div>
          <div><span>Redeem fee (stays in vault)</span><b>{zec(preview.fee)} ZEC</b></div>
          {preview.belowMin && <div className="bad">Below the {s?.params.minRedeemTokens} token minimum</div>}
        </div>
      )}

      <button className="primary" disabled={!canBurn} onClick={burn}>
        {busy ?? (publicKey ? 'Burn & redeem' : 'Connect a wallet first')}
      </button>
      {err && <div className="note bad">{err}</div>}
      <div className="note">
        One transaction: SPL burn + memo <span className="mono">{s?.params.memoPrefix ?? 'ZEARN'}:{kind}:{optionFor(kind).input ? '<address>' : '<wallet>'}</span>. Burned tokens are gone for good.
        Payout is processed once the tx is finalized (about 30 seconds).
      </div>

      {mine.length > 0 && (
        <div className="tbl" style={{ marginTop: 14 }}>
          <table>
            <thead><tr><th>Tx</th><th className="num">Burned</th><th className="num">ZEC</th><th>To</th><th>Status</th></tr></thead>
            <tbody>
              {mine.map((r) => (
                <tr key={r.signature}>
                  <td><a className="mono" href={`https://solscan.io/tx/${r.signature}`} target="_blank" rel="noreferrer">{short(r.signature)}</a></td>
                  <td className="num">{tok(r.amount_raw, decimals)}</td>
                  <td className="num">{zec(r.payout_raw)}</td>
                  <td className="mono">{r.dest_kind ?? '–'} {short(r.dest_addr)}</td>
                  <td><span className={`status ${r.status}`}>{r.status}</span>{r.error && <div className="note">{r.error}</div>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
