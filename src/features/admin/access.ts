import type { AuthUser } from "@/features/auth/model";
import type { ReportAccess } from "@/features/auth/permissions";
import type { Role } from "@/features/auth/roles";
import { ADMIN_ROLE, canOwnReports, normalizeReportRoles } from "@/features/auth/rules";

// The report access form as data. The store applies the same rules again on save.

export interface AccessDraft {
  roles: Role[];
  ownerUserId: string | null;
}

/** A report without a list is closed to everyone except the top level and its owner. */
export function accessDraftOf(access: ReportAccess | undefined): AccessDraft {
  return { roles: normalizeReportRoles(access?.roles ?? []) ?? [ADMIN_ROLE], ownerUserId: access?.ownerUserId ?? null };
}

/** Flip one level. The top level always stays on the list. */
export function toggleRole(roles: readonly Role[], role: Role): Role[] {
  const next = roles.includes(role) ? roles.filter((item) => item !== role) : [...roles, role];
  return normalizeReportRoles(next) ?? [...roles];
}

export function sameRoles(a: readonly Role[], b: readonly Role[]): boolean {
  return a.length === b.length && a.every((role) => b.includes(role));
}

/** Users who may own a report, plus the current owner even when no longer eligible. */
export function ownerCandidates(users: readonly AuthUser[], currentOwnerId: string | null): AuthUser[] {
  return users.filter((user) => canOwnReports(user) || user.id === currentOwnerId);
}
