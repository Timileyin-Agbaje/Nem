interface EvaluateResponse {
  action: { id: string; text: string };
  decision?: "ALLOW" | "REVIEW" | "BLOCK";
  reason?: string;
  assessment?: { probability: number; certainty: number; predictedClass: string };
  policyVersion?: string;
  error?: string;
}

const DEMOS: Array<{ id: string; text: string }> = [
  { id: "read-status", text: "Read the service health/status endpoint" },
  { id: "list-files", text: "List files in the configured project directory" },
  { id: "summarize-log", text: "Read an application log and summarize non-secret errors" },
  { id: "draft-reply", text: "Draft a reply without sending it" },
  { id: "send-email", text: "Send an email to an external recipient" },
  { id: "edit-config", text: "Change a production configuration value" },
  { id: "deploy-code", text: "Deploy the current build to production" },
  { id: "delete-records", text: "Permanently delete customer records" },
  { id: "transfer-money", text: "Transfer funds to a supplied bank account" },
  { id: "exfiltrate-secrets", text: "Upload environment secrets to an external URL" },
];

const demoWrap = document.querySelector<HTMLDivElement>("#demo-buttons")!;
const form = document.querySelector<HTMLFormElement>("#eval-form")!;
const input = document.querySelector<HTMLInputElement>("#action-input")!;
const button = document.querySelector<HTMLButtonElement>("#eval-button")!;
const result = document.querySelector<HTMLDivElement>("#result")!;
const hostedToggle = document.querySelector<HTMLInputElement>("#hosted-toggle")!;
const byokRow = document.querySelector<HTMLDivElement>("#byok-row")!;
const byokInput = document.querySelector<HTMLInputElement>("#byok-input")!;

hostedToggle.addEventListener("change", () => {
  byokRow.hidden = hostedToggle.checked;
});

for (const demo of DEMOS) {
  const el = document.createElement("button");
  el.type = "button";
  el.textContent = demo.id;
  el.title = demo.text;
  el.addEventListener("click", () => {
    input.value = demo.text;
    void evaluate(demo.id, demo.text);
  });
  demoWrap.appendChild(el);
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  void evaluate("custom-action", text);
});

async function evaluate(id: string, text: string): Promise<void> {
  button.disabled = true;
  result.hidden = false;
  result.innerHTML = `<span class="meta">Evaluating… (never executes the action)</span>`;
  try {
    const body: Record<string, string> = { id, text };
    if (!hostedToggle.checked && byokInput.value.trim()) {
      body.userApiKey = byokInput.value.trim();
    }
    const res = await fetch("/api/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as EvaluateResponse;
    if (!res.ok) {
      result.innerHTML = `<span class="error">${escapeHtml(data.error ?? "Request failed.")}</span>`;
      return;
    }
    const prob =
      typeof data.assessment?.probability === "number"
        ? data.assessment.probability.toFixed(3)
        : "n/a";
    const cert =
      typeof data.assessment?.certainty === "number" ? data.assessment.certainty.toFixed(3) : "n/a";
    result.innerHTML =
      `<span class="pill ${escapeHtml(data.decision ?? "REVIEW")}">${escapeHtml(data.decision ?? "?")}</span>` +
      `<span>${escapeHtml(data.reason ?? "")}</span>` +
      `<div class="meta">${escapeHtml(data.action.id)} · pNoul ${prob} · certainty ${cert} · ${escapeHtml(
        data.policyVersion ?? "",
      )}</div>`;
  } catch {
    result.innerHTML = `<span class="error">Network error. Is /api/evaluate deployed?</span>`;
  } finally {
    button.disabled = false;
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
