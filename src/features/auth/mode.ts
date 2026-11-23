import { AUTH_MODES, type AuthMode } from "./store";

// Server only: AUTH_MODE is not exposed to the browser. Server components pass the result to <SessionProvider>.

const DEFAULT_MODE: AuthMode = "demo";
export const SUPABASE_URL_VAR = "NEXT_PUBLIC_SUPABASE_URL";
export const SUPABASE_KEY_VAR = "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY";

type Env = Record<string, string | undefined>;

export interface SupabaseEnv {
  url: string;
  /** The publishable (browser-safe) key. Never a service-role key. */
  key: string;
}

/** Fails fast with a clear message when a required variable is missing. Values are never included in the message. */
export function supabaseEnv(env: Env = process.env): SupabaseEnv {
  const url = env[SUPABASE_URL_VAR]?.trim();
  const key = env[SUPABASE_KEY_VAR]?.trim();
  const missing = [url ? null : SUPABASE_URL_VAR, key ? null : SUPABASE_KEY_VAR].filter((name) => name !== null);
  if (!url || !key) throw new Error(`AUTH_MODE=supabase needs ${missing.join(" and ")} to be set.`);
  return { url, key };
}

/** demo (default) or supabase. Unknown values and a half-configured supabase mode throw instead of falling back. */
export function getAuthMode(env: Env = process.env): AuthMode {
  const raw = env.AUTH_MODE?.trim().toLowerCase() || DEFAULT_MODE;
  const mode = AUTH_MODES.find((item) => item === raw);
  if (!mode) throw new Error(`AUTH_MODE must be one of: ${AUTH_MODES.join(", ")}.`);
  if (mode === "supabase") supabaseEnv(env);
  return mode;
}
