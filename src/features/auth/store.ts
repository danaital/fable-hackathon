import type { AuthUser, CreateUserInput, PasswordRequestRow, SessionUserData, SignInInput, UserPatch } from "./model";
import type { PermissionMap, ReportAccess } from "./permissions";
import type { Role } from "./roles";

export const AUTH_MODES = ["demo", "supabase"] as const;
/** demo: seeded users in this browser, NOT real security. supabase: Supabase Auth behind Bahir's own server routes. */
export type AuthMode = (typeof AUTH_MODES)[number];

/** Reports the signed-in user may open. `all` (super-admin) is different from an empty list. */
export interface AccessibleReports {
  all: boolean;
  ids: string[];
}

export interface SessionSnapshot {
  user: SessionUserData | null;
  reports: AccessibleReports;
}

export type RequestDecision = "approve" | "reject";

/**
 * Everything the screens need from the identity store. Two adapters implement it:
 * the local demo adapter (demoStore.ts) and the Supabase adapter (apiStore.ts + the server routes).
 * Every method rejects with an AuthError; screens show `auth.error.<code>`.
 */
export interface AuthStore {
  readonly mode: AuthMode;

  signIn(input: SignInInput): Promise<SessionUserData>;
  signOut(): Promise<void>;
  /** "Who am I", re-checked against the stored account each time. */
  currentSession(): Promise<SessionSnapshot>;
  /** Called after a sign-in or sign-out made through this store. */
  subscribe(listener: () => void): () => void;

  listUsers(): Promise<AuthUser[]>;
  createUser(input: CreateUserInput): Promise<{ user: AuthUser; inviteSent: boolean }>;
  /** One atomic edit of profile, role and status. A role change wipes the user's own permission changes. */
  updateUser(input: { id: string; patch: UserPatch }): Promise<AuthUser>;
  deactivateUser(id: string): Promise<AuthUser>;
  setRole(input: { id: string; role: Role }): Promise<AuthUser>;
  sendResetLink(id: string): Promise<{ emailSent: boolean }>;

  /** Public "forgot password". Always resolves the same way, whether or not the account exists. */
  requestPasswordReset(identifier: string): Promise<void>;
  listPasswordRequests(): Promise<PasswordRequestRow[]>;
  decidePasswordRequest(input: { id: string; decision: RequestDecision }): Promise<{ emailSent: boolean }>;

  /** Default permissions of every role: the stored override, or the built-in baseline. */
  getRoleDefaults(): Promise<Record<Role, PermissionMap>>;
  setRoleDefaults(input: { role: Role; permissions: PermissionMap }): Promise<PermissionMap>;

  listReportAccess(): Promise<ReportAccess[]>;
  setReportRoles(input: { reportId: string; roles: Role[] }): Promise<ReportAccess>;
  setReportOwner(input: { reportId: string; userId: string | null }): Promise<ReportAccess>;
  /** Access rows go away with the report. */
  deleteReportAccess(reportId: string): Promise<void>;
}
