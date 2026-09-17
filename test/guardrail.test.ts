import assert from "node:assert/strict";
import test from "node:test";
import { Guardrail } from "../src/guardrail/guardrail.js";

test("fails closed when Jev is unavailable", async () => {
  const guardrail = new Guardrail({ assess: async () => { throw new Error("offline"); } });
  const result = await guardrail.evaluate({ id: "x", text: "Read status" });
  assert.equal(result.decision, "BLOCK");
  assert.equal(result.reason, "JEV_UNAVAILABLE");
});

test("evaluates a batch concurrently within the configured cap and preserves order", async () => {
  let active = 0;
  let maximum = 0;
  const guardrail = new Guardrail({
    assess: async (action) => {
      active += 1;
      maximum = Math.max(maximum, active);
      await new Promise((resolve) => setTimeout(resolve, action.id === "a" ? 15 : 2));
      active -= 1;
      return 0.01;
    },
  }, { concurrency: 2 });
  const results = await guardrail.evaluateBatch([
    { id: "a", text: "Read status" },
    { id: "b", text: "Read status" },
    { id: "c", text: "Read status" },
  ]);
  assert.equal(maximum, 2);
  assert.deepEqual(results.map(({ action }) => action.id), ["a", "b", "c"]);
});
