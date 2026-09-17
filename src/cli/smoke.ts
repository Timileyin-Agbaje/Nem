import { main } from "./main.js";

if (process.env.JEV_LIVE_SMOKE !== "1") {
  console.error("Refusing live call: set JEV_LIVE_SMOKE=1 explicitly");
  process.exitCode = 2;
} else {
  // This action is evaluated only; the guardrail never executes it.
  process.exitCode = await main([
    "--action",
    "Read the service health/status endpoint",
    "--id",
    "read-status",
    "--json",
  ]);
}
