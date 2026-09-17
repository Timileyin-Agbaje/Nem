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

TypeSafe is required for the Jev runtime schemas and public result types. Install
and read the TypeSafe skill before extending those boundaries. The current
offline implementation uses a narrow adapter validator until that prerequisite
is available in the coding environment.

## Configuration

Set these variables only in the process environment or an ignored `.env` file:

```sh
JEV_BASE_URL=https://your-jev-host
JEV_API_KEY=your-key
GUARDRAIL_CONCURRENCY=5
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

## Live smoke test

Live Jev calls are intentionally opt-in. Run the harmless smoke test
files, command arguments, or committed configuration.
