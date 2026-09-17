import assert from "node:assert/strict";
import test from "node:test";
import { JevClient, JevClientError } from "../src/jev/client.js";

function response(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

test("sends a typed System One request and extracts the Noul answer", async () => {
  let request: { url: string; init: RequestInit | undefined } | undefined;
  const client = new JevClient({
    baseUrl: "https://api.example",
    apiKey: "test-key",
    maxRetries: 0,
    fetchFn: async (url, init) => {
      request = { url: String(url), init };
      return response({
        model: "jev-latest",
        answers: { risky: { type: "noul", noul: 0.72 } },
        usage: { input_tokens: 1, output_tokens: 0 },
      });
    },
  });

  assert.equal(await client.assess({ id: "a1", text: "Send an email" }), 0.72);
  assert.equal(request?.url, "https://api.example/v1/systemone");
  assert.equal(request?.init?.method, "POST");
  assert.equal(request?.init?.headers && new Headers(request.init.headers).get("authorization"), "Bearer test-key");
  const body = JSON.parse(String(request?.init?.body)) as { model: string; state: { action: string }; questions: { risky: { type: string } } };
  assert.equal(body.model, "jev-latest");
  assert.equal(body.state.action, "Send an email");
  assert.equal(body.questions.risky.type, "noul");
});

test("translates malformed SDK responses to a safe adapter error", async () => {
  const client = new JevClient({
    baseUrl: "https://api.example",
    apiKey: "test-key",
    maxRetries: 0,
    fetchFn: async () => response({ model: "jev-latest", answers: {}, usage: { input_tokens: 1, output_tokens: 0 } }),
  });
  await assert.rejects(
    client.assess({ id: "bad", text: "Read status" }),
    (error: unknown) => error instanceof JevClientError && error.code === "JEV_UNAVAILABLE",
  );
});

test("translates transport failures without leaking credentials", async () => {
  const client = new JevClient({
    baseUrl: "https://api.example",
    apiKey: "secret-key",
    maxRetries: 0,
    fetchFn: async () => { throw new Error("network failed"); },
  });
  await assert.rejects(
    client.assess({ id: "down", text: "Read status" }),
    (error: unknown) => error instanceof JevClientError && error.code === "JEV_UNAVAILABLE" && !error.message.includes("secret-key"),
  );
});
