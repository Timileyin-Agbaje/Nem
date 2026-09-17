import { noul, TypeSafeClient } from "@typesafe-ai/sdk";
import type { AgentAction } from "../domain/types.js";

export interface JevClientOptions {
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly timeoutMs?: number;
  readonly maxRetries?: number;
  readonly fetchFn?: typeof fetch;
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

  constructor(options: JevClientOptions) {
    try {
      this.client = new TypeSafeClient({
        apiKey: options.apiKey,
        baseURL: options.baseUrl,
        defaultModel: process.env.TYPESAFE_DEFAULT_MODEL ?? "jev-latest",
        timeout: options.timeoutMs ?? 5000,
        retry: { maxRetries: options.maxRetries ?? 2 },
        logLevel: "off",
        ...(options.fetchFn ? { fetch: options.fetchFn } : {}),
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
