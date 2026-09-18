# nem — Agent Action Guardrail

![Node >= 20](https://img.shields.io/badge/node-%3E%3D20-brightgreen)
![TypeScript strict](https://img.shields.io/badge/typescript-strict-blue)
![License: MIT](https://img.shields.io/badge/license-MIT-green)
![Fail-closed](https://img.shields.io/badge/safety-fail--closed-red)

A fail-closed Node.js/TypeScript guardrail for evaluating proposed agent
actions with Jev **before** they are executed. It returns `ALLOW`, `REVIEW`,
or `BLOCK`; it never executes an action.

Live demo (hosted key, rate-limited): deploy `web/` on Vercel and try the
10-action playground. Local use brings your own key.

## 30-second quickstart

```sh
nvm use # or Node.js 20+
npm install
npm run check   # typecheck + offline tests, no key needed
npm run demo    # pretty offline demo, no key needed
```

Live evaluation (evaluation-only, never executes the action):

```sh
JEV_API_KEY=your-key npm run cli -- --action 'Read the service status' --id read-status
JEV_API_KEY=your-key npm run cli -- --demo --json
```

## How it works

| pNoul | Decision | Meaning |
| --- | --- | --- |
| `< 0.20` | `ALLOW` | Low unsafe likelihood (still escalated if operationally risky) |
| `0.20 – <0.80` | `REVIEW` | Ambiguous — needs a human |
| `>= 0.80` | `BLOCK` | High unsafe likelihood — reject automatically |

Plus a local operational-risk boundary: external messages, deletes,
permission/config changes, deploys, money movement, secrets/PII, and prod
access escalate `ALLOW` → `REVIEW`, never downgrade `BLOCK`. Destructive /
credential-exfiltration patterns `BLOCK` deterministically. Any Jev error,
timeout, bad shape, missing key, or bad probability fails closed as `BLOCK`.

`ALLOW` is a model- and policy-based signal, not authorization.

## Setup

Requires Node.js 20+. `web/` is a Vite + Tailwind playground deployed on Vercel.

```sh
npm install
npm run check
```

The official `@typesafe-ai/sdk` is used for typed `systemOne` + Noul
responses. Offline tests need no key.

### Configuration

Set these only in the process environment, an ignored `.env` file, or the
Vercel dashboard (never commit keys):

```sh
TYPESAFE_BASE_URL=https://api.typesafe.ai
TYPESAFE_API_KEY=your-key
# JEV_BASE_URL and JEV_API_KEY are supported aliases
GUARDRAIL_CONCURRENCY=5
JEV_TIMEOUT_MS=5000
JEV_MAX_RETRIES=2
```

Local CLI = bring your own key. Hosted `/api/evaluate` uses the server's
`JEV_API_KEY` (rate-limited) unless the caller supplies `userApiKey`
per-request (never logged or stored).

## CLI

```sh
npm run cli -- --action 'Read the service status' --id read-status
npm run cli -- --demo --json
npm run demo # offline, colorful, no key — best for screenshots / X
```

Human output shows id, decision, reason. `--json` emits typed results.
Exit code `2` when any result is `BLOCK` or the guardrail errors. The
evaluated action is never executed.

Opt-in live smoke (harmless, evaluation-only):

```sh
JEV_LIVE_SMOKE=1 npm run smoke
```

## Web playground (`web/` + `/api/evaluate`)

- `web/` — minimal polished Vite UI: 10 demo actions + custom input,
  `ALLOW green / REVIEW amber / BLOCK red` pills, hosted-key vs BYOK toggle.
- `api/evaluate.ts` — Vercel serverless function. Key stays server-side,
  10 req/min/IP, 500-char cap, single action per request, redacted errors.

```sh
npm run build:web  # builds web/
```

Set `JEV_API_KEY` (or `TYPESAFE_API_KEY`) in Vercel → Environment Variables.
No key is ever bundled into `web/dist`.

## Project layout

```text
src/domain/    action, decision, reason, policy types
src/jev/       TypeSafe SDK adapter, timeout/retry, redacted errors
src/policy/    thresholds (noul-v1) + operational-risk boundary
src/guardrail/ single + bounded-batch orchestration
src/cli/       demo command, JSON/human output
src/demo/      fixed 10-action set
api/           Vercel hosted-demo endpoint (server key only)
web/           Vite playground (no secrets)
test/          offline unit + integration fixtures
```

## Security notes for public sharing

- Browser never sees `JEV_API_KEY`. Only `api/` reads it from server env.
- BYOK keys travel per-request over HTTPS and are never logged, stored, or returned.
- Rate-limited demo endpoint, fail-closed on any uncertainty.
- See `AGENT_ACTION_GUARDRAIL_PLAN.md` for the full policy contract.

## License

MIT — see [LICENSE](./LICENSE).
