import { demoActions } from "../demo/actions.js";
import { Guardrail } from "../guardrail/guardrail.js";
import { JevClient } from "../jev/client.js";
import type { AgentAction } from "../domain/types.js";

function usage(): string {
  return "Usage: npm run cli -- [--demo] [--action '<text>' [--id <id>]] [--json]";
}

function makeGuardrail(): Guardrail {
  const baseUrl = process.env.JEV_BASE_URL;
  const apiKey = process.env.JEV_API_KEY;
  if (!baseUrl || !apiKey) {
    throw new Error("JEV_BASE_URL and JEV_API_KEY are required");
  }
  return new Guardrail(new JevClient({ baseUrl, apiKey, timeoutMs: Number(process.env.JEV_TIMEOUT_MS ?? 5000), maxRetries: Number(process.env.JEV_MAX_RETRIES ?? 2) }), {
    concurrency: Number(process.env.GUARDRAIL_CONCURRENCY ?? 5),
  });
}

function parseArgs(args: readonly string[]): { actions: AgentAction[]; json: boolean } {
  const json = args.includes("--json");
  if (args.includes("--demo")) return { actions: [...demoActions], json };
  const actionIndex = args.indexOf("--action");
  if (actionIndex >= 0 && args[actionIndex + 1]) {
    const idIndex = args.indexOf("--id");
    return {
      actions: [{ id: idIndex >= 0 ? args[idIndex + 1] ?? "action" : "action", text: args[actionIndex + 1]! }],
      json,
    };
  }
  throw new Error(usage());
}

export async function main(args = process.argv.slice(2)): Promise<number> {
  try {
    const { actions, json } = parseArgs(args);
    const results = await makeGuardrail().evaluateBatch(actions);
    if (json) console.log(JSON.stringify(results));
    else for (const result of results) console.log(`${result.action.id}: ${result.decision} (${result.reason})`);
    return results.some(({ decision }) => decision === "BLOCK") ? 2 : 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Guardrail failed";
    console.error(message);
    return 2;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exitCode = await main();
}
