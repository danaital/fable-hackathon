import { userPatchSchema, type AuthError, type AuthUser, type UserPatch } from "@/features/auth/model";
import type { ReportAccess } from "@/features/auth/permissions";
import { ASSIGNABLE_ROLES, SUSPEND_ROLE, type Role } from "@/features/auth/roles";
import { checkCreate, checkReset, checkUserChange, type Actor } from "@/features/auth/rules";

// What the users screen shows before the admin tries: the same pure rules the store applies (rules.ts).

export interface UserLocks {
  /** Why profile and level cannot be edited. */
  edit: AuthError | null;
  /** Why the account cannot be switched off (or back on). */
  status: AuthError | null;
  /** Why a reset link cannot be sent. */
  reset: AuthError | null;
}

interface LocksInput {
  actor: Actor;
  target: AuthUser;
  access: readonly ReportAccess[];
}

export function userLocks({ actor, target, access }: LocksInput): UserLocks {
  const ownedReports = access.filter((item) => item.ownerUserId === target.id).map((item) => item.reportId);
  return {
    edit: checkUserChange({ actor, target, patch: {}, ownedReports }),
    status: checkUserChange({ actor, target, patch: { isActive: !target.isActive }, ownedReports }),
    reset: checkReset(actor, target),
  };
}

export interface RoleOption {
  role: Role;
  disabled: boolean;
}

/** Levels in the select, highest first. The suspend level is offered only when editing; the top level only to root. */
export function roleOptions({ actor, editing }: { actor: Actor; editing: boolean }): RoleOption[] {
  const options = ASSIGNABLE_ROLES.map((role) => ({ role, disabled: checkCreate(actor, role) !== null }));
  return editing ? [...options, { role: SUSPEND_ROLE, disabled: false }] : options;
}

export const USER_TEXT_FIELDS = ["firstName", "lastName", "username", "email"] as const;
export type UserTextField = (typeof USER_TEXT_FIELDS)[number];
export type UserDraft = Pick<AuthUser, UserTextField | "role">;

const DEFAULT_ROLE: Role = "viewer";
export const EMPTY_USER_DRAFT: UserDraft = { firstName: "", lastName: "", username: "", email: "", role: DEFAULT_ROLE };

export const draftOf = ({ firstName, lastName, username, email, role }: AuthUser): UserDraft => ({ firstName, lastName, username, email, role });

const trimmed = (draft: UserDraft): UserDraft => ({
  ...draft,
  firstName: draft.firstName.trim(),
  lastName: draft.lastName.trim(),
  username: draft.username.trim(),
  email: draft.email.trim(),
});

/** One edit request: only the properties that differ from the stored user. */
export function changedPatch(user: AuthUser, draft: UserDraft): UserPatch {
  const next = trimmed(draft);
  const patch: UserPatch = {};
  for (const field of USER_TEXT_FIELDS) if (next[field] !== user[field]) patch[field] = next[field];
  if (next.role !== user.role) patch.role = next.role;
  return patch;
}

/** Fields that fail the schema the store validates with, so form rules and store rules cannot drift. */
export function invalidFields(draft: UserDraft): UserTextField[] {
  const result = userPatchSchema.safeParse(trimmed(draft));
  if (result.success) return [];
  const failed = new Set(result.error.issues.map((issue) => issue.path[0]));
  return USER_TEXT_FIELDS.filter((field) => failed.has(field));
}
