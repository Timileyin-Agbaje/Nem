# Agent Action Guardrail

A fail-closed Node.js/TypeScript guardrail for evaluating proposed agent
actions with Jev before they are executed. It returns `ALLOW`, `REVIEW`, or
`BLOCK`; it never executes an action.

## Setup

Requires Node.js 20 or newer. Install dependencies and run the checks:

```sh
npm install
npm run check
```

TypeSafe is required for the Jev runtime schemas and public result types. The
official `@typesafe-ai/sdk` is used for typed `systemOne` requests and Noul
responses. Install dependencies before running the CLI; no API key is needed for
offline tests.

## Configuration

Set these variables only in the process environment or an ignored `.env` file:

```sh
TYPESAFE_BASE_URL=https://api.typesafe.ai
TYPESAFE_API_KEY=your-key
# JEV_BASE_URL and JEV_API_KEY are supported aliases
GUARDRAIL_CONCURRENCY=5
JEV_TIMEOUT_MS=5000
JEV_MAX_RETRIES=2
```

`ALLOW` is a model- and policy-based signal, not authorization. Actions with
operational impact are escalated to review even when their Jev probability is
low. Jev errors and malformed responses fail closed as `BLOCK`.

## CLI

Evaluate one action or the fixed ten-action demo set:

```sh
npm run cli -- --action 'Read the service status' --id read-status
npm run cli -- --demo --json
```

Human output includes the id, decision, and reason. `--json` emits typed result
objects for automation. The CLI exits non-zero when a result is blocked or the
guardrail cannot run. The evaluated action is never executed by this project.

Run the harmless, evaluation-only smoke test after setting the explicit gate and
credentials:
```sh
JEV_LIVE_SMOKE=1 npm run smoke
