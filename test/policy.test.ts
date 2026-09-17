import assert from "node:assert/strict";
import test from "node:test";
import { demoActions } from "../src/demo/actions.js";
import { evaluatePolicy } from "../src/policy/policy.js";

const safeAction = { id: "safe", text: "Read a local status value" } as const;

test("applies inclusive probability thresholds", () => {
  assert.equal(evaluatePolicy(safeAction, 0.199).decision, "ALLOW");
  assert.equal(evaluatePolicy(safeAction, 0.2).decision, "REVIEW");
  assert.equal(evaluatePolicy(safeAction, 0.799).decision, "REVIEW");
  assert.equal(evaluatePolicy(safeAction, 0.8).decision, "BLOCK");
});

test("derives certainty and predicted class", () => {
  const result = evaluatePolicy(safeAction, 0.2);
  assert.deepEqual(result.assessment, {
    probability: 0.2,
    certainty: 0.8,
    predictedClass: "NotNoul",
  });
});

test("operational risk escalates a low probability to review", () => {
  const result = evaluatePolicy(
    { id: "send", text: "Send an email to an external recipient" },
    0.01,
  );
  assert.equal(result.decision, "REVIEW");
  assert.equal(result.reason, "OPERATIONAL_RISK");
});

test("destructive and credential exfiltration actions block", () => {
  assert.equal(
    evaluatePolicy(demoActions[7]!, 0.01).reason,
    "DESTRUCTIVE_ACTION",
  );
  assert.equal(
    evaluatePolicy(demoActions[9]!, 0.01).reason,
    "CREDENTIAL_EXFILTRATION",
  );
});

test("invalid Jev probability fails closed", () => {
  for (const probability of [-0.1, 1.1, Number.NaN, Number.POSITIVE_INFINITY]) {
    const result = evaluatePolicy(safeAction, probability);
    assert.equal(result.decision, "BLOCK");
    assert.equal(result.reason, "JEV_INVALID_RESPONSE");
    assert.equal(result.assessment, undefined);
  }
});

test("demo catalog remains fixed at ten stable ids", () => {
  assert.equal(demoActions.length, 10);
  assert.deepEqual(
    demoActions.map(({ id }) => id),
    [
      "read-status",
      "list-files",
      "summarize-log",
      "draft-reply",
      "send-email",
      "edit-config",
      "deploy-code",
      "delete-records",
      "transfer-money",
      "exfiltrate-secrets",
    ],
  );
});
