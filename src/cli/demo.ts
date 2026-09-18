import { demoActions } from "../demo/actions.js";
import { Guardrail } from "../guardrail/guardrail.js";
import type { Decision } from "../domain/types.js";

// Offline fixture probabilities — chosen to show off the full policy range
// without needing a JEV_API_KEY. Perfect for screenshots / X.
const FIXTURE_PROBABILITIES: Record<string, number> = {
  "read-status": 0.05,
  "list-files": 0.08,
  "summarize-log": 0.12,
  "draft-reply": 0.1,
  "send-email": 0.35,
  "edit-config": 0.45,
  "deploy-code": 0.6,
  "delete-records": 0.05, // BLOCK via local destructive rule, not probability
  "transfer-money": 0.75,
  "exfiltrate-secrets": 0.9,
};

const COLORS: Record<Decision, string> = {
  ALLOW: "\x1b[32m",
  REVIEW: "\x1b[33m",
  BLOCK: "\x1b[31m",
};
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";

export function fixtureProbability(id: string): number {
  return FIXTURE_PROBABILITIES[id] ?? 0.5;
}

export async function main(): Promise<number> {
  const guardrail = new Guardrail(
    { assess: async (action) => fixtureProbability(action.id) },
    { concurrency: 5 },
  );
  const results = await guardrail.evaluateBatch(demoActions);

  console.log(`${BOLD}nem — offline demo (no key needed)${RESET}`);
  console.log(`${DIM}thresholds: ALLOW < 0.20 · REVIEW 0.20–0.80 · BLOCK >= 0.80${RESET}\n`);
  for (const r of results) {
    const color = COLORS[r.decision];
    const prob =
      typeof r.assessment?.probability === "number" ? r.assessment.probability.toFixed(2) : "n/a";
    console.log(
      `${color}${BOLD}${r.decision.padEnd(6)}${RESET} ${r.action.id.padEnd(18)} ${DIM}pNoul ${prob} · ${r.reason}${RESET}`,
    );
  }
  const counts = {
    ALLOW: results.filter((r) => r.decision === "ALLOW").length,
    REVIEW: results.filter((r) => r.decision === "REVIEW").length,
    BLOCK: results.filter((r) => r.decision === "BLOCK").length,
  };
  console.log(
    `\n${DIM}—\n${counts.ALLOW} ALLOW · ${counts.REVIEW} REVIEW · ${counts.BLOCK} BLOCK · policy ${results[0]?.policyVersion}${RESET}`,
  );
  console.log(`${DIM}Live check: JEV_API_KEY=your-key npm run cli -- --demo --json${RESET}`);
  return results.some((r) => r.decision === "BLOCK") ? 2 : 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exitCode = await main();
}
