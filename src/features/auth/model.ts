import { z } from "zod";
import { permissionMapSchema } from "./permissions";
import { ROLES } from "./roles";

// Shared by the screens, the demo adapter and the server routes, so form rules and server rules cannot drift.

const NAME_MAX = 100;
const EMAIL_MAX = 255;
export const PASSWORD_MIN_CHARS = 8;
export const PASSWORD_MAX_BYTES = 72;
const NO_WHITESPACE = /^\S+$/;
const HEBREW = /[֐-׿]/;

const roleSchema = z.enum(ROLES);
const nameSchema = z.string().trim().min(1).max(NAME_MAX);

/** The user row admin screens see. Never carries a password, token or reset link. */
export const authUserSchema = z.object({
  id: z.string().min(1),
  firstName: z.string(),
  lastName: z.string(),
  username: z.string(),
  email: z.string(),
  role: roleSchema,
  isActive: z.boolean(),
  /** The one protected top account. */
  isRoot: z.boolean(),
  permissionOverrides: permissionMapSchema,
  createdAt: z.string(),
});
export type AuthUser = z.infer<typeof authUserSchema>;

const userFields = {
  firstName: nameSchema,
  lastName: nameSchema,
  username: z.string().trim().min(1).max(NAME_MAX).regex(NO_WHITESPACE),
  email: z.email().max(EMAIL_MAX),
  role: roleSchema,
};

/** A new user can never be created suspended. */
export const createUserSchema = z.strictObject({ ...userFields, role: roleSchema.exclude(["deny"]) });
export type CreateUserInput = z.infer<typeof createUserSchema>;

/** One edit request: only the changed properties are sent. */
export const userPatchSchema = z.strictObject({ ...userFields, isActive: z.boolean() }).partial();
export type UserPatch = z.infer<typeof userPatchSchema>;

export const signInSchema = z.strictObject({ identifier: z.string().trim().min(1).max(EMAIL_MAX), password: z.string().min(1) });
export type SignInInput = z.infer<typeof signInSchema>;

export const passwordRequestSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  purpose: z.enum(["invite", "admin_reset", "forgot"]),
  status: z.enum(["pending", "approved", "rejected", "superseded", "used"]),
  requestedAt: z.string(),
  decidedByUserId: z.string().nullable(),
  decidedAt: z.string().nullable(),
});
export type PasswordRequest = z.infer<typeof passwordRequestSchema>;

/** A pending request joined with the user it belongs to, for the approval screen. */
export interface PasswordRequestRow {
  id: string;
  userId: string;
  name: string;
  username: string;
  email: string;
  requestedAt: string;
}

export const reportAccessSchema = z.object({
  reportId: z.string().min(1),
  roles: z.array(roleSchema),
  ownerUserId: z.string().nullable(),
});

/** Machine-readable refusal reasons. Each maps to the message key `auth.error.<code>`. */
export const AUTH_ERROR_CODES = [
  "invalidCredentials",
  "unavailable",
  "unexpected",
  "signedOut",
  "forbidden",
  "notFound",
  "invalid",
  "emailTaken",
  "usernameTaken",
  "selfChange",
  "rootProtected",
  "rootOnly",
  "ownsReports",
  "inactiveUser",
  "notSupported",
] as const;
export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[number];

export class AuthError extends Error {
  constructor(
    readonly code: AuthErrorCode,
    /** Extra text for the message, e.g. the reports a user owns. Never a secret. */
    readonly detail = "",
  ) {
    super(code);
    this.name = "AuthError";
  }
}

export function toAuthError(error: unknown): AuthError {
  return error instanceof AuthError ? error : new AuthError("unexpected");
}

/** First and last name; falls back to the username, then the email. */
export function displayName(user: Pick<AuthUser, "firstName" | "lastName" | "username" | "email">): string {
  return `${user.firstName} ${user.lastName}`.trim() || user.username || user.email;
}

export type PasswordProblem = "tooShort" | "tooLong";

/** At least 8 characters and at most 72 bytes as UTF-8 (a Hebrew letter is 2 bytes). The password is never altered. */
export function passwordProblem(password: string): PasswordProblem | null {
  if (password.length < PASSWORD_MIN_CHARS) return "tooShort";
  if (new TextEncoder().encode(password).length > PASSWORD_MAX_BYTES) return "tooLong";
  return null;
}

export function hasHebrew(text: string): boolean {
  return HEBREW.test(text);
}

const HOME = "/";
const RETURN_BASE = "http://local.invalid";
// Browsers strip tabs and newlines inside a URL, so "/\t/evil.example" would become "//evil.example".
const UNSAFE_PATH_CHARS = /[\u0000-\u001F\u007F\\]/;

/**
 * The page to go to after sign-in, sign-out or a refused route. Use this for every redirect target that
 * comes from a query string or a form, on the server too. Only a same-origin relative path passes;
 * the result is rebuilt from the parsed URL, never the raw input.
 */
export function safeReturnPath(value: string | null | undefined): string {
  if (!value || UNSAFE_PATH_CHARS.test(value) || !value.startsWith("/") || value.startsWith("//")) return HOME;
  try {
    const url = new URL(value, RETURN_BASE);
    return url.origin === RETURN_BASE ? `${url.pathname}${url.search}${url.hash}` : HOME;
  } catch {
    return HOME;
  }
}

/** The answer of sign-in and "who am I". One schema, validated on both sides. */
export const sessionUserSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  email: z.string(),
  username: z.string(),
  /** Effective role. */
  role: roleSchema,
  isRoot: z.boolean(),
  /** Effective permission map. */
  permissions: permissionMapSchema,
});
export type SessionUserData = z.infer<typeof sessionUserSchema>;
