import assert from "node:assert/strict";
import test from "node:test";
import handler from "../api/evaluate.js";
import { clearRateLimit } from "../api/_lib/rate-limit.js";
import { validateEvaluateBody } from "../api/_lib/validate.js";

function mockRes() {
  const res: { statusCode: number; payload: unknown; headers: Record<string, string> } = {
    statusCode: 200,
    payload: undefined,
    headers: {},
  };
  const api = {
    status(code: number) {
      res.statusCode = code;
      return api;
    },
    json(payload: unknown) {
      res.payload = payload;
    },
    setHeader(name: string, value: string) {
      res.headers[name] = value;
    },
  };
  return { res, api };
}

test("validateEvaluateBody accepts id/text and optional BYOK key", () => {
  assert.deepEqual(validateEvaluateBody({ text: "Read status" }), {
    id: "custom-action",
    text: "Read status",
  });
  assert.deepEqual(
    validateEvaluateBody({ id: "read-status", text: "  Read status  ", userApiKey: " k " }),
    { id: "read-status", text: "Read status", userApiKey: "k" },
  );
});

test("validateEvaluateBody rejects empty, oversized, and bad ids", () => {
  assert.throws(() => validateEvaluateBody({}), /text/);
  assert.throws(() => validateEvaluateBody({ text: "x".repeat(501) }), /500/);
  assert.throws(() => validateEvaluateBody({ id: "bad id!", text: "hi" }), /id/);
});

test("handler rejects non-POST and bad bodies without touching Jev", async () => {
  clearRateLimit();
  const { res, api } = mockRes();
  await handler({ method: "GET", body: {}, headers: {}, socket: { remoteAddress: "1.1.1.1" } }, api as never);
  assert.equal(res.statusCode, 405);

  const bad = mockRes();
  await handler(
    { method: "POST", body: { text: "" }, headers: {}, socket: { remoteAddress: "1.1.1.2" } },
    bad.api as never,
  );
  assert.equal(bad.res.statusCode, 400);
});

test("handler rate-limits at 10 req/min/IP", async () => {
  clearRateLimit();
  const ip = "9.9.9.9";
  for (let i = 0; i < 10; i += 1) {
    const { res, api } = mockRes();
    await handler({ method: "GET", body: {}, headers: {}, socket: { remoteAddress: ip } }, api as never);
    assert.notEqual(res.statusCode, 429);
  }
  const { res, api } = mockRes();
  await handler({ method: "GET", body: {}, headers: {}, socket: { remoteAddress: ip } }, api as never);
  assert.equal(res.statusCode, 429);
});

test("handler fails closed with BLOCK when no server key and no BYOK", async () => {
  clearRateLimit();
  const prevJev = process.env.JEV_API_KEY;
  const prevTs = process.env.TYPESAFE_API_KEY;
  delete process.env.JEV_API_KEY;
  delete process.env.TYPESAFE_API_KEY;
  try {
    const { res, api } = mockRes();
    await handler(
      {
        method: "POST",
        body: { id: "read-status", text: "Read status" },
        headers: {},
        socket: { remoteAddress: "2.2.2.2" },
      },
      api as never,
    );
    assert.equal(res.statusCode, 200);
    const payload = res.payload as { decision: string; reason: string; apiKey?: string };
    assert.equal(payload.decision, "BLOCK");
    assert.equal(payload.reason, "JEV_UNAVAILABLE");
    assert.equal(payload.apiKey, undefined);
  } finally {
    if (prevJev !== undefined) process.env.JEV_API_KEY = prevJev;
    if (prevTs !== undefined) process.env.TYPESAFE_API_KEY = prevTs;
  }
});
