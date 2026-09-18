export interface ValidatedEvaluateBody {
  readonly id: string;
  readonly text: string;
  readonly userApiKey?: string;
}

const MAX_TEXT_LENGTH = 500;
const MAX_ID_LENGTH = 64;
const MAX_KEY_LENGTH = 200;
const ID_PATTERN = /^[a-z0-9][a-z0-9-_]*$/i;

export function validateEvaluateBody(body: unknown): ValidatedEvaluateBody {
  if (typeof body !== "object" || body === null) {
    throw new Error("Body must be a JSON object with a 'text' field.");
  }
  const record = body as Record<string, unknown>;
  const rawText = record.text;
  if (typeof rawText !== "string" || !rawText.trim()) {
    throw new Error("'text' is required and must be a non-empty string.");
  }
  const text = rawText.trim();
  if (text.length > MAX_TEXT_LENGTH) {
    throw new Error(`'text' must be ${MAX_TEXT_LENGTH} characters or fewer.`);
  }

  const rawId = record.id;
  let id = "custom-action";
  if (rawId !== undefined) {
    if (typeof rawId !== "string" || !rawId.trim()) {
      throw new Error("'id' must be a non-empty string when provided.");
    }
    id = rawId.trim();
    if (id.length > MAX_ID_LENGTH || !ID_PATTERN.test(id)) {
      throw new Error("'id' must be alphanumeric with dashes/underscores, 64 chars max.");
    }
  }

  const rawKey = record.userApiKey;
  let userApiKey: string | undefined;
  if (rawKey !== undefined && rawKey !== null && rawKey !== "") {
    if (typeof rawKey !== "string" || !rawKey.trim()) {
      throw new Error("'userApiKey' must be a non-empty string when provided.");
    }
    userApiKey = rawKey.trim();
    if (userApiKey.length > MAX_KEY_LENGTH) {
      throw new Error("'userApiKey' is too long.");
    }
  }

  return userApiKey ? { id, text, userApiKey } : { id, text };
}
