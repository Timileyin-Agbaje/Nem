// Minimal sliding-window limiter for the hosted demo endpoint.
// In-memory only: fine for a single-region low-traffic X demo.
// Upgrade to Vercel KV/Upstash if you go multi-region or see abuse.

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 10;

const hits = new Map<string, number[]>();

export function isRateLimited(key: string, now = Date.now()): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_REQUESTS) {
    hits.set(key, recent);
    return true;
  }
  recent.push(now);
  hits.set(key, recent);
  return false;
}

export function clearRateLimit(): void {
  hits.clear();
}

export function getClientIp(req: unknown): string {
  if (typeof req !== "object" || req === null) return "unknown";
  const headers = (req as { headers?: Record<string, unknown> }).headers ?? {};
  const forwarded = headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0]!.trim();
  }
  const realIp = headers["x-real-ip"];
  if (typeof realIp === "string" && realIp.trim()) return realIp.trim();
  const socketIp = (req as { socket?: { remoteAddress?: string } }).socket?.remoteAddress;
  return socketIp ?? "unknown";
}
