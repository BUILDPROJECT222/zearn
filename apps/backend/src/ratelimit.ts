/** Tiny fixed-window limiter per client IP (single instance deploy, so in-memory is enough). */
type Bucket = { count: number; reset: number };
const buckets = new Map<string, Bucket>();

export function allow(key: string, limit: number, windowMs = 60_000): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset <= now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  b.count++;
  return b.count <= limit;
}

// drop expired buckets so the map cannot grow without bound
setInterval(() => {
  const now = Date.now();
  for (const [k, b] of buckets) if (b.reset <= now) buckets.delete(k);
}, 60_000).unref();
