import type { AgentAction, GuardrailResult } from "../domain/types.js";
import { JevClientError } from "../jev/client.js";
import { evaluatePolicy, POLICY_VERSION } from "../policy/policy.js";

export interface ProbabilityProvider {
  assess(action: AgentAction): Promise<number>;
}

export interface GuardrailOptions {
  readonly concurrency?: number;
}

export class Guardrail {
  private readonly concurrency: number;

  constructor(
    private readonly provider: ProbabilityProvider,
    options: GuardrailOptions = {},
  ) {
    this.concurrency = Math.max(1, Math.floor(options.concurrency ?? 5));
  }

  async evaluate(action: AgentAction): Promise<GuardrailResult> {
    try {
      const probability = await this.provider.assess(action);
      const decision = evaluatePolicy(action, probability);
      return { action, ...decision, attempts: 1 };
    } catch (error) {
      const reason = error instanceof JevClientError ? error.code : "JEV_UNAVAILABLE";
      return {
        action,
        decision: "BLOCK",
        reason,
        policyVersion: POLICY_VERSION,
        attempts: 1,
      };
    }
  }

  async evaluateBatch(actions: readonly AgentAction[]): Promise<GuardrailResult[]> {
    const results = new Array<GuardrailResult>(actions.length);
    let nextIndex = 0;
    const worker = async (): Promise<void> => {
      while (nextIndex < actions.length) {
        const index = nextIndex;
        nextIndex += 1;
        results[index] = await this.evaluate(actions[index]!);
      }
    };
    await Promise.all(Array.from({ length: Math.min(this.concurrency, actions.length) }, worker));
    return results;
  }
}
