import { z } from "zod";
import { type Role } from "./roles";

// One permission vocabulary everywhere: a typed pair, feature + action.
// Only actions that a screen and a server route can both check are listed (see "Don't copy" in the spec).
export const PERMISSIONS = {
  reports: ["view", "export", "refresh", "manage_columns"],
  views: ["view", "create", "edit", "delete"],
  charts: ["view", "create", "edit", "delete"],
  widgets: ["view", "create", "edit", "delete"],
  settings: ["view", "edit", "currency"],
  export_templates: ["view", "create", "edit", "delete"],
} as const;

export type Feature = keyof typeof PERMISSIONS;
export const FEATURES = Object.keys(PERMISSIONS) as Feature[];
export type PermissionMap = Partial<Record<Feature, string[]>>;

export interface Permission {
  feature: Feature;
  action: string;
}

const VIEW = "view";
const TOP_ROLE: Role = "super-admin";

function isKnownAction(feature: Feature, action: string): boolean {
  return (PERMISSIONS[feature] as readonly string[]).includes(action);
}

/** Rejects unknown features (strict keys) and unknown actions. */
export const permissionMapSchema: z.ZodType<PermissionMap> = z
  .partialRecord(z.enum(FEATURES), z.array(z.string()))
  .refine((map) => FEATURES.every((feature) => (map[feature] ?? []).every((action) => isKnownAction(feature, action))));

const pick = (actions: (feature: Feature) => readonly string[]): PermissionMap =>
  Object.fromEntries(FEATURES.map((feature) => [feature, [...actions(feature)]]));

const ALL = pick((feature) => PERMISSIONS[feature]);
const VIEW_ONLY = pick(() => [VIEW]);

/** Built-in defaults per role. An admin can replace a role's map on the roles screen. */
export const BASELINE: Record<Role, PermissionMap> = {
  "super-admin": ALL,
  admin: ALL,
  manager: { ...ALL, settings: ["view", "edit"] },
  supervisor: { ...VIEW_ONLY, reports: ["view", "export", "refresh"], views: ["view", "create", "edit"] },
  viewer: VIEW_ONLY,
  deny: {},
};

export type RoleDefaults = Partial<Record<Role, PermissionMap>>;

interface ResolveInput {
  role: Role;
  isRoot?: boolean;
  /** Stored role overrides; a role without one uses the baseline. */
  roleDefaults?: RoleDefaults;
  /** Per-user changes, applied feature by feature on top of the role's defaults. */
  overrides?: PermissionMap;
}

/** The single resolver: used for the user object sent to screens and for every check. */
export function resolvePermissions({ role, isRoot, roleDefaults, overrides }: ResolveInput): PermissionMap {
  if (isRoot) return BASELINE[TOP_ROLE];
  if (role === "deny") return {};
  return { ...(roleDefaults?.[role] ?? BASELINE[role]), ...overrides };
}

interface Checkable {
  role: Role;
  permissions: PermissionMap;
}

/** Signed out, "deny", unknown feature or unknown action all refuse. A super-admin passes every check. */
export function can(user: Checkable | null | undefined, { feature, action }: Permission): boolean {
  if (!user || user.role === "deny") return false;
  if (user.role === TOP_ROLE) return true;
  return user.permissions[feature]?.includes(action) ?? false;
}

export interface ReportAccess {
  reportId: string;
  /** Exact-role allow-list. No ladder: allowing "viewer" does not allow "manager". */
  roles: Role[];
  ownerUserId: string | null;
}

interface Opener {
  id: string;
  role: Role;
}

/** One rule for both the report list and each report: super-admin, the owner, or a role on the list. */
export function canOpenReport(user: Opener | null | undefined, access: ReportAccess | undefined): boolean {
  if (!user || user.role === "deny") return false;
  if (user.role === TOP_ROLE) return true;
  if (!access) return false;
  return access.ownerUserId === user.id || access.roles.includes(user.role);
}

export function countActions(map: PermissionMap): number {
  return Object.values(map).reduce((total, actions) => total + actions.length, 0);
}

/** Matrix columns, highest role first. "deny" has no column. */
export const MATRIX_ROLES: readonly Role[] = ["super-admin", "admin", "manager", "supervisor", "viewer"];

/** Matrix rows: every action except "view", which each signed-in role keeps. */
export const MATRIX_ROWS: readonly Permission[] = FEATURES.flatMap((feature) =>
  PERMISSIONS[feature].filter((action) => action !== VIEW).map((action) => ({ feature, action })),
);

/** Flip one cell. Unchecking the last action of a feature removes the feature. */
export function toggleAction(map: PermissionMap, { feature, action }: Permission): PermissionMap {
  const current = map[feature] ?? [];
  const next = current.includes(action) ? current.filter((item) => item !== action) : [...current, action];
  const result: PermissionMap = { ...map, [feature]: next };
  if (next.length === 0) delete result[feature];
  return result;
}
