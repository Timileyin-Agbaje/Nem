import assert from "node:assert/strict";
import test from "node:test";
import { Guardrail } from "../src/guardrail/guardrail.js";
import { fixtureProbability } from "../src/cli/demo.js";
import { demoActions } from "../src/demo/actions.js";

test("offline demo fixtures cover ALLOW, REVIEW, and BLOCK", async () => {
  const guardrail = new Guardrail({
    assess: async (action) => fixtureProbability(action.id),
  });
  const results = await guardrail.evaluateBatch(demoActions);
  const decisions = new Set(results.map((r) => r.decision));
  assert.ok(decisions.has("ALLOW"));
  assert.ok(decisions.has("REVIEW"));
  assert.ok(decisions.has("BLOCK"));
  assert.equal(results.length, 10);
});
