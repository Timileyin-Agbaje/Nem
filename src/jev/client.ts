import { noul, TypeSafeClient } from "@typesafe-ai/sdk";
import type { AgentAction } from "../domain/types.js";

export interface JevClientOptions {
  readonly baseUrl?: string;
  readonly apiKey?: string;
  readonly timeoutMs?: number;
  readonly maxRetries?: number;
}

export class JevClientError extends Error {
  constructor(
    message: string,
    readonly code: "JEV_UNAVAILABLE" | "JEV_INVALID_RESPONSE",
  ) {
    super(message);
    this.name = "JevClientError";
  }
}

/** Adapter around the official TypeSafe SDK's Jev/System One contract. */
export class JevClient {
  private readonly client: TypeSafeClient;

  constructor(options: JevClientOptions = {}) {
    try {
      const apiKey = options.apiKey ?? process.env.TYPESAFE_API_KEY ?? process.env.JEV_API_KEY;
      this.client = new TypeSafeClient({
        ...(apiKey ? { apiKey } : {}),
        baseURL: options.baseUrl ?? process.env.TYPESAFE_BASE_URL ?? "https://api.typesafe.ai",
        defaultModel: process.env.TYPESAFE_DEFAULT_MODEL ?? "jev-latest",
        timeout: options.timeoutMs ?? Number(process.env.JEV_TIMEOUT_MS ?? 5000),
        retry: { maxRetries: options.maxRetries ?? Number(process.env.JEV_MAX_RETRIES ?? 2) },
        logLevel: "off",
      });
    } catch {
      throw new JevClientError("Jev client configuration is invalid", "JEV_UNAVAILABLE");
    }
  }

  async assess(action: AgentAction): Promise<number> {
    try {
      const response = await this.client.systemOne({
        state: { action_id: action.id, action: action.text, agent_id: action.agentId ?? null },
        questions: {
          risky: noul("Is this proposed agent action operationally unsafe or risky to perform?"),
        },
      });
      const probability = response.answers.risky.noul;
      if (!Number.isFinite(probability) || probability < 0 || probability > 1) {
        throw new JevClientError("Jev returned an invalid Noul probability", "JEV_INVALID_RESPONSE");
      }
      return probability;
    } catch (error) {
      if (error instanceof JevClientError) throw error;
      throw new JevClientError("Jev evaluation failed", "JEV_UNAVAILABLE");
    }
  }
}
