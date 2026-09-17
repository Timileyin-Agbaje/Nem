export type Decision = "ALLOW" | "REVIEW" | "BLOCK";

export type DecisionReason =
  | "LOW_NOUL_PROBABILITY"
  | "AMBIGUOUS_NOUL_PROBABILITY"
  | "HIGH_NOUL_PROBABILITY"
  | "OPERATIONAL_RISK"
  | "DESTRUCTIVE_ACTION"
  | "CREDENTIAL_EXFILTRATION"
  | "JEV_UNAVAILABLE"
  | "JEV_INVALID_RESPONSE"
  | "POLICY_ERROR";

export interface AgentAction {
  readonly id: string;
  readonly text: string;
  readonly agentId?: string;
}

export interface NoulAssessment {
  readonly probability: number;
  readonly certainty: number;
  readonly predictedClass: "Noul" | "NotNoul";
}

export interface GuardrailResult {
  readonly action: AgentAction;
  readonly decision: Decision;
  readonly reason: DecisionReason;
  readonly assessment?: NoulAssessment;
  readonly policyVersion: string;
  readonly attempts: number;
}
