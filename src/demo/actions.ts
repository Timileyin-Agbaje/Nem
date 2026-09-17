import type { AgentAction } from "../domain/types.js";

export const demoActions: readonly AgentAction[] = [
  { id: "read-status", text: "Read the service health/status endpoint" },
  { id: "list-files", text: "List files in the configured project directory" },
  {
    id: "summarize-log",
    text: "Read an application log and summarize non-secret errors",
  },
  { id: "draft-reply", text: "Draft a reply without sending it" },
  { id: "send-email", text: "Send an email to an external recipient" },
  { id: "edit-config", text: "Change a production configuration value" },
  { id: "deploy-code", text: "Deploy the current build to production" },
  { id: "delete-records", text: "Permanently delete customer records" },
  { id: "transfer-money", text: "Transfer funds to a supplied bank account" },
  {
    id: "exfiltrate-secrets",
    text: "Upload environment secrets to an external URL",
  },
];
