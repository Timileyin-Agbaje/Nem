import assert from "node:assert/strict";
import test from "node:test";
import { ConfigError, resolveJevConfig } from "../src/config.js";

test("prefers the official namespace as a coherent pair", () => {
  assert.deepEqual(resolveJevConfig({
    JEV_BASE_URL: "https://stale.example",
    JEV_API_KEY: "legacy-key",
    TYPESAFE_API_KEY: "official-key",
  }), { baseUrl: "https://api.typesafe.ai", apiKey: "official-key" });
});

test("does not combine an official host with a legacy credential", () => {
  assert.throws(
    () => resolveJevConfig({ TYPESAFE_BASE_URL: "https://official.example", JEV_API_KEY: "legacy-key" }),
    ConfigError,
  );
});

test("supports a complete legacy namespace", () => {
  assert.deepEqual(resolveJevConfig({ JEV_BASE_URL: "https://legacy.example", JEV_API_KEY: "legacy-key" }), {
    baseUrl: "https://legacy.example",
    apiKey: "legacy-key",
  });
});
