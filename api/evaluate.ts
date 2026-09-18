import { Guardrail } from "../src/guardrail/guardrail.js";
import { JevClient } from "../src/jev/client.js";
import { POLICY_VERSION } from "../src/policy/policy.js";
import { getClientIp, isRateLimited } from "./_lib/rate-limit.js";
import { validateEvaluateBody } from "./_lib/validate.js";

interface VercelRequest {
  method?: string;
  body?: unknown;
  headers?: Record<string, unknown>;
  socket?: { remoteAddress?: string };
}

interface VercelResponse {
  status: (code: number) => VercelResponse;
  json: (payload: unknown) => void;
  setHeader: (name: string, value: string) => void;
}

function resolveServerKey(): { baseUrl: string; apiKey: string } | null {
  const hasOfficial =
    process.env.TYPESAFE_BASE_URL !== undefined || process.env.TYPESAFE_API_KEY !== undefined;
  const baseUrl = hasOfficial
    ? process.env.TYPESAFE_BASE_URL ?? "https://api.typesafe.ai"
    : process.env.JEV_BASE_URL ?? "https://api.typesafe.ai";
  const apiKey = hasOfficial ? process.env.TYPESAFE_API_KEY : process.env.JEV_API_KEY;
  if (!apiKey?.trim()) return null;
  return { baseUrl, apiKey };
}

// POST /api/evaluate { id?, text, userApiKey? }
// userApiKey (BYOK) is used for that request only, never logged or stored.
// Otherwise the server's JEV_API_KEY/TYPESAFE_API_KEY is used (rate-limited demo).
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader("Cache-Control", "no-store");
  const ip = getClientIp(req);
  if (isRateLimited(`evaluate:${ip}`)) {
    res.status(429).json({ error: "Rate limited. Try again in a minute (10 req/min/IP)." });
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed. Use POST." });
    return;
  }

  let input;
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    input = validateEvaluateBody(body);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Invalid request body." });
    return;
  }

  const serverKey = resolveServerKey();
  const effectiveKey = input.userApiKey ?? serverKey?.apiKey;
  const baseUrl =
    serverKey?.baseUrl ??
    process.env.TYPESAFE_BASE_URL ??
    process.env.JEV_BASE_URL ??
    "https://api.typesafe.ai";

  if (!effectiveKey) {
    // Fail closed, no key to evaluate with.
    res.status(200).json({
      action: { id: input.id, text: input.text },
      decision: "BLOCK",
      reason: "JEV_UNAVAILABLE",
      policyVersion: POLICY_VERSION,
      attempts: 0,
      note: "Hosted key not configured. Supply userApiKey (BYOK).",
    });
    return;
  }

  try {
    const guardrail = new Guardrail(
      new JevClient({
        baseUrl,
        apiKey: effectiveKey,
        timeoutMs: Number(process.env.JEV_TIMEOUT_MS ?? 5000),
        maxRetries: Number(process.env.JEV_MAX_RETRIES ?? 2),
      }),
      { concurrency: 1 },
    );
    const result = await guardrail.evaluate({ id: input.id, text: input.text });
    res.status(200).json(result);
  } catch {
    res.status(200).json({
      action: { id: input.id, text: input.text },
      decision: "BLOCK",
      reason: "JEV_UNAVAILABLE",
      policyVersion: POLICY_VERSION,
      attempts: 1,
    });
  }
}
