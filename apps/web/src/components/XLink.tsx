/** X (Twitter) link; renders nothing until X_HANDLE is configured on the backend. */
export default function XLink({ handle, label = false }: { handle: string | null | undefined; label?: boolean }) {
  if (!handle) return null;
  return (
    <a className="xlink" href={`https://x.com/${handle}`} target="_blank" rel="noreferrer" aria-label={`Zearn on X (@${handle})`} title={`@${handle} on X`}>
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
        <path fill="currentColor" d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
      {label && <span>@{handle}</span>}
    </a>
  );
}
