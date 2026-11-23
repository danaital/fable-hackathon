import { AuthError, type AuthUser, type UserPatch } from "./model";
import { OWNER_MIN_ROLE, roleAtLeast, type Role } from "./roles";

// Protection rules for editing users. Pure, so the demo adapter and the server routes apply the same ones.

export const ADMIN_ROLE: Role = "super-admin";

export interface Actor {
  id: string;
  role: Role;
  isRoot: boolean;
}

type Target = Pick<AuthUser, "id" | "role" | "isActive" | "isRoot">;

/** Who may act on `target` at all: not yourself, not the root account, and only root touches a super-admin. */
function checkReach(actor: Actor, target: Target): AuthError | null {
  if (!roleAtLeast(actor.role, ADMIN_ROLE)) return new AuthError("forbidden");
  if (actor.id === target.id) return new AuthError("selfChange");
  if (target.isRoot) return new AuthError("rootProtected");
  if (target.role === ADMIN_ROLE && !actor.isRoot) return new AuthError("rootOnly");
  return null;
}

export function checkCreate(actor: Actor, role: Role): AuthError | null {
  if (!roleAtLeast(actor.role, ADMIN_ROLE)) return new AuthError("forbidden");
  if (role === "deny") return new AuthError("invalid");
  if (role === ADMIN_ROLE && !actor.isRoot) return new AuthError("rootOnly");
  return null;
}

interface ChangeInput {
  actor: Actor;
  target: Target;
  patch: UserPatch;
  /** Titles or ids of the reports the target owns. */
  ownedReports: readonly string[];
}

export function checkUserChange({ actor, target, patch, ownedReports }: ChangeInput): AuthError | null {
  const reach = checkReach(actor, target);
  if (reach) return reach;
  if (patch.role === ADMIN_ROLE && !actor.isRoot) return new AuthError("rootOnly");

  const demoting = patch.role !== undefined && roleAtLeast(target.role, OWNER_MIN_ROLE) && !roleAtLeast(patch.role, OWNER_MIN_ROLE);
  const deactivating = patch.isActive === false && target.isActive;
  if ((demoting || deactivating) && ownedReports.length > 0) return new AuthError("ownsReports", ownedReports.join(", "));
  return null;
}

/** A reset link is refused for your own row, for inactive and "deny" users, and across the root rules. */
export function checkReset(actor: Actor, target: Target): AuthError | null {
  const reach = checkReach(actor, target);
  if (reach) return reach;
  if (!target.isActive || target.role === "deny") return new AuthError("inactiveUser");
  return null;
}

/** Editing a role's default permissions: no "deny" column, and the top column is root only. */
export function checkRoleDefaultsEdit(actor: Actor, role: Role): AuthError | null {
  if (!roleAtLeast(actor.role, ADMIN_ROLE)) return new AuthError("forbidden");
  if (role === "deny") return new AuthError("invalid");
  if (role === ADMIN_ROLE && !actor.isRoot) return new AuthError("rootOnly");
  return null;
}

/** Only an active user with role admin or higher may own a report. */
export function canOwnReports(user: Pick<AuthUser, "role" | "isActive">): boolean {
  return user.isActive && roleAtLeast(user.role, OWNER_MIN_ROLE);
}

/** The top role is always kept on a report's list; duplicates are dropped; "deny" is rejected. */
export function normalizeReportRoles(roles: readonly Role[]): Role[] | null {
  if (roles.includes("deny")) return null;
  return [...new Set<Role>([ADMIN_ROLE, ...roles])];
}
