import type { I18nKey } from "@/i18n/en";
import type { ToneName } from "@/styles/theme";

// No "use client" here on purpose: server routes and client screens share this one ladder.

/** Lowest to highest. "deny" blocks everything. Checks are always "this role or higher". */
export const ROLES = ["deny", "viewer", "supervisor", "manager", "admin", "super-admin"] as const;
export type Role = (typeof ROLES)[number];

const LOWEST_ROLE: Role = "deny";

export function roleAtLeast(role: Role, min: Role): boolean {
  return role !== LOWEST_ROLE && ROLES.indexOf(role) >= ROLES.indexOf(min);
}

/** Stored values are untrusted: underscores become hyphens, anything unknown counts as the lowest rank. */
export function normalizeRole(value: unknown): Role {
  const text = typeof value === "string" ? value.trim().toLowerCase().replaceAll("_", "-") : "";
  return ROLES.find((role) => role === text) ?? LOWEST_ROLE;
}

/** Roles an admin may hand out, highest first. "deny" is offered only when editing (it suspends an account). */
export const ASSIGNABLE_ROLES: readonly Role[] = ["super-admin", "admin", "manager", "supervisor", "viewer"];
export const SUSPEND_ROLE: Role = LOWEST_ROLE;
/** Lowest role that may own a report. */
export const OWNER_MIN_ROLE: Role = "admin";

const ROLE_LABEL_KEYS = {
  deny: "auth.role.deny",
  viewer: "auth.role.viewer",
  supervisor: "auth.role.supervisor",
  manager: "auth.role.manager",
  admin: "auth.role.admin",
  "super-admin": "auth.role.super-admin",
} as const satisfies Record<Role, I18nKey>;

const ROLE_SUMMARY_KEYS = {
  deny: "auth.roleCan.deny",
  viewer: "auth.roleCan.viewer",
  supervisor: "auth.roleCan.supervisor",
  manager: "auth.roleCan.manager",
  admin: "auth.roleCan.admin",
  "super-admin": "auth.roleCan.super-admin",
} as const satisfies Record<Role, I18nKey>;

/** i18n key of a role's translated name, e.g. t(roleLabelKey(user.role)). */
export function roleLabelKey(role: Role): I18nKey {
  return ROLE_LABEL_KEYS[role];
}

/** i18n key of one plain-language line on what the role can do. */
export function roleSummaryKey(role: Role): I18nKey {
  return ROLE_SUMMARY_KEYS[role];
}

/** Badge tone per role. Cosmetic only; the role name is always shown as text next to it. */
export const ROLE_TONE: Record<Role, ToneName> = {
  deny: "danger",
  viewer: "neutral",
  supervisor: "info",
  manager: "info",
  admin: "warning",
  "super-admin": "success",
};

/** Lowest role that sees the admin area. */
export const ADMIN_AREA_MIN_ROLE: Role = "super-admin";
