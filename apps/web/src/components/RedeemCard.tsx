import { useEffect, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';
import { createBurnCheckedInstruction, getAssociatedTokenAddressSync } from '@solana/spl-token';
import { Buffer } from 'buffer';
import { api, short, tok, zec, type Redeem, type RedeemPreview, type VaultState } from '../api';
import { DEST_OPTIONS, destFor, destValid, optionFor, type DestKind } from '../dest';
import PayoutStatus from './PayoutStatus';

const MEMO_PROGRAM = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

export default function RedeemCard({ s, onDone }: { s: VaultState | null; onDone: () => void }) {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const [amount, setAmount] = useState('');
  const [kind, setKind] = useState<DestKind>('SOL');
  const [zaddr, setZaddr] = useState('');
  const [preview, setPreview] = useState<RedeemPreview | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [mine, setMine] = useState<Redeem[]>([]);
  const [balance, setBalance] = useState<number | null>(null);

  const decimals = s?.tokenDecimals ?? 6;
  const n = parseFloat(amount) || 0;

  useEffect(() => {
    if (!n || !s) return setPreview(null);
    setPreview(null);
    const t = setTimeout(() => api.redeemPreview(n, kind).then(setPreview).catch(() => setPreview(null)), 250);
    return () => clearTimeout(t);
  }, [n, kind, s?.floorRaw]);

  const loadMine = () => publicKey && api.redeems(publicKey.toBase58()).then(setMine).catch(() => {});
  useEffect(() => {
    loadMine();
    if (!publicKey || !s?.mint) return setBalance(null);
    const program = s.tokenProgram ? new PublicKey(s.tokenProgram) : undefined;
    connection
      .getTokenAccountBalance(getAssociatedTokenAddressSync(new PublicKey(s.mint), publicKey, false, program))
      .then((b) => setBalance(b.value.uiAmount ?? 0))
      // no token account yet = 0; any other failure = unknown (hide the balance rather than claim 0)
      .catch((e) => setBalance(/could not find account|Invalid param/i.test(String((e as Error).message)) ? 0 : null));
  }, [publicKey, s?.mint]);

  useEffect(() => {
    if (!mine.some((r) => r.status === 'pending' || r.status === 'paying')) return;
    const id = setInterval(loadMine, 8000);
    return () => clearInterval(id);
  }, [mine]);

  const dest = destFor(kind, publicKey?.toBase58(), zaddr);
  const payoutOk = !!preview && preview.ok; // the backend decides: zero payout, token minimum and payout minimum
  const arbClosed = s?.arbGapPct != null && s.arbGapPct <= 0;
  const canBurn = !!publicKey && !!s?.mint && !!s.tokenProgram && n > 0 && !busy && payoutOk && destValid(kind, publicKey?.toBase58(), zaddr);
  const blockReason = !publicKey
    ? 'Connect a wallet first'
    : !s?.tokenProgram
      ? 'Waiting for mint info…'
      : n <= 0
        ? 'Enter an amount'
        : !preview
          ? 'Calculating…'
          : preview.payoutZero
            ? BigInt(s.floorRaw) <= 0n
              ? 'Payout would be 0 ZEC — vault is empty'
              : 'Payout rounds to 0 ZEC — burn more'
            : preview.belowMin
              ? `Minimum is ${s.params.minRedeemTokens.toLocaleString('en-US')} ZEARN`
              : preview.belowMinPayout
                ? `Payout below the ${zec(preview.minPayoutRaw, 6)} ZEC minimum — burn more`
                : !destValid(kind, publicKey?.toBase58(), zaddr)
                  ? 'Enter a valid destination'
                  : null;

  async function burn() {
    if (!publicKey || !s) return;
    setErr(null);
    try {
      const mint = new PublicKey(s.mint);
      const program = new PublicKey(s.tokenProgram!); // SPL Token or Token-2022, reported by the backend
      const ata = getAssociatedTokenAddressSync(mint, publicKey, false, program);
      const raw = BigInt(Math.floor(n * 10 ** decimals));
      const memo = `${s.params.memoPrefix}:${kind}:${dest}`;
      const tx = new Transaction().add(
        createBurnCheckedInstruction(ata, mint, publicKey, raw, decimals, [], program),
        new TransactionInstruction({ keys: [], programId: MEMO_PROGRAM, data: Buffer.from(memo, 'utf8') }),
      );
      setBusy('Waiting for wallet signature…');
      const sig = await sendTransaction(tx, connection);
      setBusy('Waiting for Solana confirmation…');
      // poll over HTTP: the RPC proxy has no websocket for confirmTransaction subscriptions
      for (let i = 0; i < 60; i++) {
        const st = (await connection.getSignatureStatuses([sig])).value[0];
        if (st?.err) throw new Error('burn transaction failed on-chain');
        if (st && (st.confirmationStatus === 'confirmed' || st.confirmationStatus === 'finalized')) break;
        if (i === 59) throw new Error(`not confirmed yet; your burn ${sig.slice(0, 8)}… will still be picked up by the scanner`);
        await new Promise((r) => setTimeout(r, 2000));
      }
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
      <h2>Emergency exit: burn $ZEARN, receive ZEC</h2>
      <p className="sub">Your pro-rata share of the Floor Vault, minus a {s ? s.params.redeemFeeBps / 100 : 2}% fee that stays in the vault for everyone else. Meant for when the price has dumped below the floor.</p>
      {s && s.floorZec <= 0 && (
        <div className="preview" style={{ borderColor: 'var(--red)', marginTop: 0 }}>
          <div><span>The vault is empty, there is no floor yet</span><b className="bad">0 ZEC</b></div>
          <div className="note" style={{ marginTop: 4 }}>Burning now would pay nothing. The floor fills as creator fees are swept into ZEC.</div>
        </div>
      )}
      {s && s.floorZec > 0 && arbClosed && (
        <div className="preview" style={{ borderColor: 'var(--gold)', marginTop: 0 }}>
          <div><span>Market price is above the floor right now</span><b className="gold">{s!.arbGapPct!.toFixed(1)}% gap</b></div>
          <div className="note" style={{ marginTop: 4 }}>Selling on pump.fun pays more than burning today. Redeem only if you specifically want ZEC, or once the price sits below the floor.</div>
        </div>
      )}

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
          <div><span>You receive</span><b className={preview.ok ? 'gold' : 'bad'}>{zec(preview.payout, 8)} ZEC</b></div>
          <div><span>Worth</span><b>{s ? `$${((Number(preview.payout) / 1e8) * s.prices.zec).toFixed(4)}` : '–'}</b></div>
          <div><span>Redeem fee (stays in vault)</span><b>{zec(preview.fee, 8)} ZEC</b></div>
          <div><span>Minimum payout</span><b>{zec(preview.minPayoutRaw, 6)} ZEC</b></div>
          {preview.blockedReason && <div className="bad">{preview.blockedReason}</div>}
        </div>
      )}

      <button className="primary" disabled={!canBurn} onClick={burn}>
        {busy ?? blockReason ?? 'Burn & redeem'}
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
                  <td><PayoutStatus r={r} withNote /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
