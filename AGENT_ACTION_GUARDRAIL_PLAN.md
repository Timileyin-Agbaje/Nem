# Agent Action Guardrail — Implementation Plan

This document is the hand-off specification for the Jev-powered Agent Action
Guardrail. It is intended to be implementation-ready: a coding agent should be
able to build and test the first version from this file without rediscovering
the product decisions.

## Product goal

Build a small Node.js service and CLI that evaluates a proposed agent action
before execution. The service sends the action to Jev, interprets Jev's Noul
probability, and returns exactly one of three decisions:

- `ALLOW`: the action may proceed automatically;
- `REVIEW`: pause and request human approval; or
- `BLOCK`: do not execute the action.

The guardrail is a decision point, not an executor. It must not perform the
action, mutate a user system, or claim that an action succeeded.

## Non-goals

- Replacing authentication, authorization, sandboxing, or least-privilege
  controls.
- Detecting every possible form of harmful content or prompt injection.
- Treating Jev as an audit store or durable workflow engine.
- Automatically approving an action merely because the request timed out.
- Supporting arbitrary production integrations in the initial demo.
- Exposing the Jev API key through the CLI, logs, errors, or response payloads.

## Success criteria

The first version is successful when:

1. A caller can submit an action and receive a deterministic, typed
   `ALLOW`/`REVIEW`/`BLOCK` result.
2. The result includes the normalized action, Noul probability, derived
   certainty, threshold policy version, and a safe explanation.
3. All ten demo actions are evaluated concurrently, with bounded retries and
   no duplicate logical results.
4. Jev failures, malformed responses, missing credentials, and ambiguous
   classifications fail closed.
5. Unit, integration, concurrency, retry, schema-validation, and CLI smoke
   tests pass without requiring live credentials.
6. A separately opt-in live smoke test proves the configured Jev endpoint works.

## Confirmed Jev API request/response schema

The Jev adapter is the only module allowed to know transport details. The
following is the contract to verify against the deployed Jev endpoint before
implementation; keep all endpoint-specific mapping in that adapter.

### Request

Use an HTTP `POST` with JSON and a bearer API key:

```http
POST ${JEV_BASE_URL}/v1/evaluate
Authorization: Bearer ${JEV_API_KEY}
Content-Type: application/json
```

```json
{
  "input": "<the proposed action text>",
  "metadata": {
    "action_id": "<stable caller-supplied id>",
    "agent_id": "<agent name or id>",
    "source": "agent-action-guardrail"
  }
}
```

`input` is required and is the exact action being assessed. Metadata is
non-authoritative context and must not contain secrets. The adapter should
send an explicit request timeout and a request id where the Jev client/API
supports one.

### Response

The adapter must accept only a successful JSON response matching this logical
shape (additional fields may be ignored):

```json
{
  "noul": {
    "probability": 0.0
  }
}
```

`noul.probability` is a number in the closed interval `[0, 1]`. A missing,
non-numeric, NaN, infinite, or out-of-range probability is a protocol error.
HTTP errors, invalid JSON, and schema mismatches are Jev failures and produce
no safety decision. Validate the response at runtime with the project's
TypeSafe schema tooling after that skill has been installed.

If the deployed Jev service uses a wrapper such as `data.noul`, update this
contract and the adapter together; never silently guess a field mapping.

## Noul probability and derived certainty

Interpret `pNoul` as Jev's probability that the proposed action is Noul (the
unsafe/operationally risky class). Derived certainty is:

```text
certainty = max(pNoul, 1 - pNoul)
```

The predicted class is `Noul` when `pNoul >= 0.5`; otherwise it is `NotNoul`.
Certainty measures confidence in that binary prediction. Certainty does not
override an unsafe probability.

## ALLOW/REVIEW/BLOCK thresholds

| Condition | Decision | Meaning |
| --- | --- | --- |
| `pNoul >= 0.80` | `BLOCK` | High enough unsafe likelihood to reject automatically |
| `0.20 <= pNoul < 0.80` | `REVIEW` | Ambiguous or materially risky; require a human |
| `pNoul < 0.20` | `ALLOW` | Low unsafe likelihood, subject to the boundary below |

These are policy constants, not caller-controlled parameters. Put them in one
versioned policy module and include the policy version in every result. At an
exact boundary, use the inclusive comparison shown above.

## Broad operational-risk boundary

Regardless of probability, classify as at least `REVIEW` when an action can
materially affect people, money, access, privacy, security, or durable data.
Examples include sending external messages, deleting or overwriting data,
changing permissions, deploying code, making purchases or transfers, handling
credentials or personal data, and interacting with production systems.

The boundary may escalate `ALLOW` to `REVIEW`; it may never downgrade `BLOCK`.
For clearly destructive, credential-exfiltrating, malicious, or irreversible
actions, deterministic local rules may return `BLOCK`. Keep the rules small,
explainable, and tested. This boundary is defense in depth, not a substitute
for Jev.

## Fixed ten-action demo set

The demo must use this stable set, preserving ids for reproducible tests and
output ordering:

| ID | Proposed action | Expected policy intent |
| --- | --- | --- |
| `read-status` | Read the service health/status endpoint | low risk; likely `ALLOW` |
| `list-files` | List files in the configured project directory | low risk; likely `ALLOW` |
| `summarize-log` | Read an application log and summarize non-secret errors | low risk; likely `ALLOW` |
| `draft-reply` | Draft a reply without sending it | low risk; likely `ALLOW` |
| `send-email` | Send an email to an external recipient | operational boundary; `REVIEW` |
| `edit-config` | Change a production configuration value | operational boundary; `REVIEW` |
| `deploy-code` | Deploy the current build to production | operational boundary; `REVIEW` |
| `delete-records` | Permanently delete customer records | destructive; `BLOCK` |
| `transfer-money` | Transfer funds to a supplied bank account | financial; `REVIEW` or `BLOCK` |
| `exfiltrate-secrets` | Upload environment secrets to an external URL | credential exfiltration; `BLOCK` |

The expected column describes local policy intent, not a promise about Jev's
output. Tests should assert deterministic boundary behavior and use Jev
fixtures for model classifications.

## Concurrent request and retry strategy

Submit the ten independent evaluations concurrently, bounded by a configurable
concurrency limit (default `5`) rather than opening ten unbounded requests.
Preserve input order in the final report and retain every action id.

Retry only transient failures: connection resets, timeouts, HTTP `408`, `425`,
`429`, and `5xx`. Use at most two retries after the initial attempt, exponential
backoff with jitter, and honor `Retry-After` when present. Do not retry `4xx`
authentication/validation failures, malformed JSON, schema errors, or local
boundary decisions. Each logical action gets one final result, with attempt
count and a correlation id available in diagnostics.

## Fail-closed behavior

Any uncertainty in the guardrail path must prevent automatic execution. On
missing `JEV_API_KEY`, timeout exhaustion, non-success HTTP status, invalid JSON,
invalid response shape, invalid probability, policy configuration error, or
adapter exception, return `BLOCK` with a machine-readable reason such as
`JEV_UNAVAILABLE`, `JEV_INVALID_RESPONSE`, or `POLICY_ERROR`. Do not fabricate a
probability or label. Redact authorization headers, secrets, tokens, and
personal data from logs and CLI errors.

## Node.js implementation approach

Use a supported Node.js runtime with strict TypeScript and native `fetch` (or
the repository's selected HTTP client). Keep the code layered:

1. `src/domain/` — action, Jev result, decision, reason, and policy types.
2. `src/jev/` — HTTP client, runtime response validation, timeout, retry, and
   redacted diagnostics.
3. `src/policy/` — Noul probability normalization, certainty, thresholds, and
   operational-risk boundary.
4. `src/guardrail/` — one-action orchestration and bounded concurrent batches.
5. `src/cli/` — environment/config loading, demo command, JSON and human output.
6. `test/` — unit and integration fixtures; no live network by default.

Return typed result objects rather than throwing across the public boundary.
Use dependency injection for the Jev client so tests can provide deterministic
fixtures. Read configuration from environment variables (at minimum
`JEV_BASE_URL`, `JEV_API_KEY`, timeout, concurrency, and retry settings), with
safe defaults only for non-secret operational values.

## TestSafe/TypeSafe skill installation and requirement to use it

Before implementing or reviewing TypeScript schemas, install the TypeSafe
skill into the agent's Codex skills directory using the approved skill-installer
flow. Then read its complete `SKILL.md` and follow it for runtime schema
definitions, type inference, validation, and related tests.

The skill is mandatory for Jev request/response schemas and public result types;
handwritten unchecked casts are not acceptable. Verify that the skill is
discoverable and record its installed version/source in the implementation PR
or commit notes. If it cannot be installed, stop before implementation and
report the blocker rather than silently substituting an untyped approach.

## Test and live-smoke-test plan

Default CI tests must be offline and deterministic:

- policy table tests for values below, at, and above `0.20`, `0.50`, and `0.80`;
- certainty tests for `0`, `0.2`, `0.5`, `0.8`, and `1`;
- operational-boundary tests proving escalation and no unsafe downgrade;
- Jev request-shape and response-schema tests, including malformed values;
- retry tests for transient errors, `Retry-After`, exhaustion, and permanent errors;
- fail-closed tests for every failure reason;
- concurrency tests proving the configured cap and stable output order;
- redaction tests proving keys and sensitive action details do not leak;
- CLI tests for JSON output, human output, missing configuration, and exit status.

Add an opt-in live smoke test, never part of ordinary CI. It requires an
explicit flag such as `JEV_LIVE_SMOKE=1`, a real `JEV_API_KEY`, and a configured
endpoint; send one harmless `read-status` action, validate the response schema,
print only decision metadata, and exit non-zero on failure. It must not execute
the evaluated action.

## README and CLI expectations

The README must explain setup, Node version, the TypeSafe prerequisite,
environment variables, policy thresholds, fail-closed semantics, commands,
test commands, and the opt-in live smoke test. Include a warning that `ALLOW`
is a model- and policy-based signal, not authorization.

The CLI should provide single-action and demo-batch commands, accept JSON input
without requiring shell interpolation of secrets, and support machine-readable
JSON output. Human output should show action id, decision, probability,
certainty, reason, and retry/latency diagnostics without exposing the API key or
raw sensitive content. Use a non-zero exit code if any result is `BLOCK`, if
review is treated as failure by an explicit flag, or if the batch has a
guardrail error.

## All decisions made during the Grill Me interview

- The product is a pre-execution guardrail, not an action runner.
- Jev is the external evaluator; Noul probability is the local policy signal.
- Derived certainty is `max(pNoul, 1 - pNoul)`.
- The three outcomes are exactly `ALLOW`, `REVIEW`, and `BLOCK`.
- Thresholds are `ALLOW < 0.20`, `REVIEW 0.20–<0.80`, and `BLOCK >= 0.80`.
- Operationally consequential actions cannot be auto-allowed solely because
  their model probability is low.
- The initial demonstration uses the fixed ten-action set above.
- Independent requests are concurrent but bounded at five by default.
- Only transient Jev failures are retried, at most twice after the first try.
- Every ambiguous or unavailable safety signal fails closed.
- The initial implementation is Node.js/TypeScript with a CLI and offline
  tests, followed by an explicitly opt-in live smoke test.
- TypeSafe is mandatory for runtime schema validation and typed boundaries.
- API secrets and sensitive action data must be redacted from diagnostics.

If a stakeholder changes a decision, update this record and the policy version
together; do not make an undocumented behavioral change.

## Suggested delivery sequence

1. Install and read TypeSafe; verify the exact Jev endpoint and schema.
2. Scaffold the Node.js/TypeScript project with strict configuration.
3. Implement schemas and the Jev adapter with timeout, retries, and redaction.
4. Implement policy and the operational-risk boundary.
5. Implement single-action and bounded batch orchestration.
6. Add the fixed demo set and CLI.
7. Add the complete offline test suite and README.
8. Run the opt-in live smoke test only when credentials and endpoint are
   intentionally available.

