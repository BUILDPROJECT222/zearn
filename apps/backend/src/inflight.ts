/** Work currently being handled by this process; the recovery job never touches these rows. */
export const inflight = {
  sweeps: new Set<number>(),
  redeems: new Set<string>(),
  claims: new Set<number>(),
};
