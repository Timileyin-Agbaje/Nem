import type { AgentAction } from "../domain/types.js";

export interface JevClientOptions {
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly timeoutMs?: number;
  readonly maxRetries?: number;
  readonly fetchFn?: typeof fetch;
  readonly sleepFn?: (ms: number) => Promise<void>;
}

export class JevClientError extends Error {
  constructor(
    message: string,
    readonly code: "JEV_UNAVAILABLE" | "JEV_INVALID_RESPONSE",
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "JevClientError";
  }
}

function isTransientStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function readProbability(value: unknown): number | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const noul = (value as { noul?: unknown }).noul;
  if (typeof noul !== "object" || noul === null || Array.isArray(noul)) return undefined;
  const probability = (noul as { probability?: unknown }).probability;
  return typeof probability === "number" && Number.isFinite(probability) && probability >= 0 && probability <= 1
    ? probability
    : undefined;
}

export class JevClient {
  private readonly fetchFn: typeof fetch;
  private readonly sleepFn: (ms: number) => Promise<void>;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;

  constructor(private readonly options: JevClientOptions) {
    this.fetchFn = options.fetchFn ?? fetch;
    this.sleepFn = options.sleepFn ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.timeoutMs = options.timeoutMs ?? 5000;
    this.maxRetries = options.maxRetries ?? 2;
  }

  async assess(action: AgentAction): Promise<number> {
    const endpoint = `${this.options.baseUrl.replace(/\/$/, "")}/v1/evaluate`;
    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
        let response: Response;
        try {
          response = await this.fetchFn(endpoint, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${this.options.apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              input: action.text,
              metadata: { action_id: action.id, agent_id: action.agentId, source: "agent-action-guardrail" },
            }),
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeout);
        }

        if (!response.ok) {
          const retryable = isTransientStatus(response.status);
          if (retryable && attempt < this.maxRetries) {
            await this.sleepFn(100 * 2 ** attempt);
            continue;
          }
          throw new JevClientError(`Jev returned HTTP ${response.status}`, "JEV_UNAVAILABLE", retryable);
        }

        let payload: unknown;
        try {
          payload = await response.json();
        } catch {
          throw new JevClientError("Jev returned invalid JSON", "JEV_INVALID_RESPONSE", false);
        }
        const probability = readProbability(payload);
        if (probability === undefined) {
          throw new JevClientError("Jev response has no valid Noul probability", "JEV_INVALID_RESPONSE", false);
        }
        return probability;
      } catch (error) {
        if (error instanceof JevClientError && !error.retryable) throw error;
        if (attempt >= this.maxRetries) {
          throw new JevClientError("Jev request failed after retries", "JEV_UNAVAILABLE", true);
        }
        await this.sleepFn(100 * 2 ** attempt);
      }
    }
    throw new JevClientError("Jev request failed", "JEV_UNAVAILABLE", true);
  }
}
