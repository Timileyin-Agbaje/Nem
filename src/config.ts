export interface JevConfig {
  readonly baseUrl: string;
  readonly apiKey: string;
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

/** Resolves one complete configuration namespace; credentials are never mixed. */
export function resolveJevConfig(env: NodeJS.ProcessEnv = process.env): JevConfig {
  const hasOfficialNamespace = env.TYPESAFE_BASE_URL !== undefined || env.TYPESAFE_API_KEY !== undefined;
  const baseUrl = hasOfficialNamespace
    ? env.TYPESAFE_BASE_URL ?? "https://api.typesafe.ai"
    : env.JEV_BASE_URL ?? "https://api.typesafe.ai";
  const apiKey = hasOfficialNamespace ? env.TYPESAFE_API_KEY : env.JEV_API_KEY;
  if (!apiKey?.trim()) {
    throw new ConfigError(hasOfficialNamespace
      ? "TYPESAFE_API_KEY is required when using TYPESAFE_* configuration"
      : "JEV_API_KEY is required when using JEV_* configuration");
  }
  return { baseUrl, apiKey };
}
