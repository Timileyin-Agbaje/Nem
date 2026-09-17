import type {
  AgentAction,
  Decision,
  DecisionReason,
  NoulAssessment,
} from "../domain/types.js";

export const POLICY_VERSION = "noul-v1";
export const ALLOW_MAX_PROBABILITY = 0.2;
export const BLOCK_MIN_PROBABILITY = 0.8;

export interface PolicyDecision {
  readonly decision: Decision;
  readonly reason: DecisionReason;
  readonly assessment?: NoulAssessment;
  readonly policyVersion: string;
}

const destructivePattern = /\b(delete|destroy|drop|wipe|erase|purge|永久削除)\b/i;
const credentialExfiltrationPattern =
  /\b(exfiltrat|upload|เผยแพร่|ส่งออก).{0,80}\b(secret|password|token|credential|api[ _-]?key|private[ _-]?key)s?\b/i;
const operationalRiskPattern =
  /\b(production|prod|external|customer|permission|access|deploy|send|email|message|purchase|pay|payment|transfer|money|bank|personal data|pii|credential|secret|overwrite|modify|change|delete)\b/i;

function hasOperationalRisk(action: AgentAction): boolean {
  return operationalRiskPattern.test(action.text);
}

function isDestructive(action: AgentAction): boolean {
  return destructivePattern.test(action.text);
}

function isCredentialExfiltration(action: AgentAction): boolean {
  return credentialExfiltrationPattern.test(action.text);
}

function assessmentFor(probability: number): NoulAssessment {
  return {
    probability,
    certainty: Math.max(probability, 1 - probability),
    predictedClass: probability >= 0.5 ? "Noul" : "NotNoul",
  };
}

/**
 * Applies the local policy after Jev has returned a Noul probability.
 * This function has no I/O and never executes the proposed action.
 */
export function evaluatePolicy(
  action: AgentAction,
  probability: number,
): PolicyDecision {
  if (!Number.isFinite(probability) || probability < 0 || probability > 1) {
    return {
      decision: "BLOCK",
      reason: "JEV_INVALID_RESPONSE",
      policyVersion: POLICY_VERSION,
    };
  }

  const assessment = assessmentFor(probability);

  if (isCredentialExfiltration(action)) {
    return {
      decision: "BLOCK",
      reason: "CREDENTIAL_EXFILTRATION",
      assessment,
      policyVersion: POLICY_VERSION,
    };
  }

  if (isDestructive(action)) {
    return {
      decision: "BLOCK",
      reason: "DESTRUCTIVE_ACTION",
      assessment,
      policyVersion: POLICY_VERSION,
    };
  }

  if (probability >= BLOCK_MIN_PROBABILITY) {
    return {
      decision: "BLOCK",
      reason: "HIGH_NOUL_PROBABILITY",
      assessment,
      policyVersion: POLICY_VERSION,
    };
  }

  if (probability >= ALLOW_MAX_PROBABILITY || hasOperationalRisk(action)) {
    return {
      decision: "REVIEW",
      reason: probability >= ALLOW_MAX_PROBABILITY
        ? "AMBIGUOUS_NOUL_PROBABILITY"
        : "OPERATIONAL_RISK",
      assessment,
      policyVersion: POLICY_VERSION,
    };
  }

  return {
    decision: "ALLOW",
    reason: "LOW_NOUL_PROBABILITY",
    assessment,
    policyVersion: POLICY_VERSION,
  };
}
