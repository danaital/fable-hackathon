import { BASELINE, FEATURES, MATRIX_ROLES, type PermissionMap } from "@/features/auth/permissions";
import type { Role } from "@/features/auth/roles";
import { checkRoleDefaultsEdit, type Actor } from "@/features/auth/rules";

// The role-permission matrix as data: one permission map per role, edited as a draft and saved per changed column.

export type RoleMaps = Record<Role, PermissionMap>;

/** Same actions per feature, in any order. A feature with no actions equals a missing feature. */
export function sameMap(a: PermissionMap, b: PermissionMap): boolean {
  return FEATURES.every((feature) => {
    const left = a[feature] ?? [];
    const right = b[feature] ?? [];
    return left.length === right.length && left.every((action) => right.includes(action));
  });
}

/** Matrix columns whose draft differs from what is stored. */
export function changedRoles(stored: RoleMaps, draft: RoleMaps): Role[] {
  return MATRIX_ROLES.filter((role) => !sameMap(stored[role], draft[role]));
}

/** Matrix columns the actor may change: the same rule the store applies. */
export function editableRoles(actor: Actor): Role[] {
  return MATRIX_ROLES.filter((role) => checkRoleDefaultsEdit(actor, role) === null);
}

export function withBuiltInDefaults(draft: RoleMaps, roles: readonly Role[]): RoleMaps {
  return { ...draft, ...Object.fromEntries(roles.map((role) => [role, BASELINE[role]])) };
}
