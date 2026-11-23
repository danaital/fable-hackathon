import { describe, expect, it } from "vitest";
import { hasHebrew, passwordProblem, safeReturnPath, createUserSchema, userPatchSchema } from "./model";
import { BASELINE, MATRIX_ROWS, can, canOpenReport, permissionMapSchema, resolvePermissions, toggleAction } from "./permissions";
import { ROLES, normalizeRole, roleAtLeast, roleLabelKey } from "./roles";
import { checkCreate, checkReset, checkUserChange, normalizeReportRoles, type Actor } from "./rules";

const root: Actor = { id: "root", role: "super-admin", isRoot: true };
const superAdmin: Actor = { id: "sa", role: "super-admin", isRoot: false };
const target = { id: "u1", role: "admin", isActive: true, isRoot: false } as const;

describe("role ladder", () => {
  it("orders roles lowest to highest and never passes deny", () => {
    expect(ROLES[0]).toBe("deny");
    expect(roleAtLeast("manager", "supervisor")).toBe(true);
    expect(roleAtLeast("viewer", "supervisor")).toBe(false);
    expect(roleAtLeast("super-admin", "super-admin")).toBe(true);
    expect(roleAtLeast("deny", "deny")).toBe(false);
  });

  it("normalizes underscores and treats unknown values as the lowest rank", () => {
    expect(normalizeRole("SUPER_ADMIN")).toBe("super-admin");
    expect(normalizeRole("owner")).toBe("deny");
    expect(normalizeRole(undefined)).toBe("deny");
  });

  it("has a label key per role", () => {
    expect(ROLES.map(roleLabelKey)).toEqual(ROLES.map((role) => `auth.role.${role}`));
  });
});

describe("permissions", () => {
  it("resolves role defaults, then stored role overrides, then per-user changes by feature", () => {
    expect(resolvePermissions({ role: "viewer" })).toEqual(BASELINE.viewer);
    const roleDefaults = { viewer: { reports: ["view", "export"] } };
    expect(resolvePermissions({ role: "viewer", roleDefaults })).toEqual({ reports: ["view", "export"] });
    expect(resolvePermissions({ role: "viewer", roleDefaults, overrides: { views: ["view", "create"] } })).toEqual({
      reports: ["view", "export"],
      views: ["view", "create"],
    });
  });

  it("gives deny nothing and root the full map whatever is stored", () => {
    expect(resolvePermissions({ role: "deny", overrides: { views: ["view"] } })).toEqual({});
    expect(resolvePermissions({ role: "viewer", isRoot: true })).toEqual(BASELINE["super-admin"]);
  });

  it("refuses signed-out users, deny, missing features and missing actions", () => {
    const viewer = { role: "viewer", permissions: BASELINE.viewer } as const;
    expect(can(null, { feature: "views", action: "view" })).toBe(false);
    expect(can({ role: "deny", permissions: BASELINE.admin }, { feature: "views", action: "view" })).toBe(false);
    expect(can(viewer, { feature: "views", action: "view" })).toBe(true);
    expect(can(viewer, { feature: "views", action: "create" })).toBe(false);
    expect(can({ role: "viewer", permissions: {} }, { feature: "views", action: "view" })).toBe(false);
    expect(can({ role: "super-admin", permissions: {} }, { feature: "views", action: "delete" })).toBe(true);
    expect(can({ role: "supervisor", permissions: BASELINE.supervisor }, { feature: "views", action: "delete" })).toBe(false);
  });

  it("matches report roles exactly, with no ladder", () => {
    const access = { reportId: "orders", roles: ["viewer" as const], ownerUserId: "owner" };
    expect(canOpenReport({ id: "a", role: "viewer" }, access)).toBe(true);
    expect(canOpenReport({ id: "a", role: "admin" }, access)).toBe(false);
    expect(canOpenReport({ id: "owner", role: "admin" }, access)).toBe(true);
    expect(canOpenReport({ id: "a", role: "super-admin" }, undefined)).toBe(true);
    expect(canOpenReport({ id: "a", role: "manager" }, undefined)).toBe(false);
    expect(canOpenReport({ id: "owner", role: "deny" }, access)).toBe(false);
  });

  it("toggles one cell and drops a feature when its last action goes", () => {
    expect(toggleAction({ views: ["view"] }, { feature: "views", action: "create" })).toEqual({ views: ["view", "create"] });
    expect(toggleAction({ views: ["view"], charts: ["view"] }, { feature: "views", action: "view" })).toEqual({ charts: ["view"] });
    expect(MATRIX_ROWS.some((row) => row.action === "view")).toBe(false);
  });

  it("rejects unknown features and actions", () => {
    expect(permissionMapSchema.safeParse({ views: ["create"] }).success).toBe(true);
    expect(permissionMapSchema.safeParse({ views: ["fly"] }).success).toBe(false);
    expect(permissionMapSchema.safeParse({ payroll: ["view"] }).success).toBe(false);
  });
});

describe("user protection rules", () => {
  it("lets nobody change their own row and nobody but root touch a super-admin", () => {
    expect(checkUserChange({ actor: root, target: { ...target, id: "root", isRoot: true }, patch: { role: "viewer" }, ownedReports: [] })?.code).toBe("selfChange");
    expect(checkUserChange({ actor: superAdmin, target: { ...target, isRoot: true }, patch: {}, ownedReports: [] })?.code).toBe("rootProtected");
    expect(checkUserChange({ actor: superAdmin, target: { ...target, role: "super-admin" }, patch: { isActive: false }, ownedReports: [] })?.code).toBe("rootOnly");
    expect(checkUserChange({ actor: superAdmin, target, patch: { role: "super-admin" }, ownedReports: [] })?.code).toBe("rootOnly");
    expect(checkUserChange({ actor: root, target, patch: { role: "super-admin" }, ownedReports: [] })).toBeNull();
    expect(checkUserChange({ actor: { id: "m", role: "manager", isRoot: false }, target, patch: {}, ownedReports: [] })?.code).toBe("forbidden");
  });

  it("blocks demotion below admin and deactivation while the user owns reports, naming them", () => {
    const blocked = checkUserChange({ actor: superAdmin, target, patch: { role: "manager" }, ownedReports: ["orders", "invoices"] });
    expect(blocked?.code).toBe("ownsReports");
    expect(blocked?.detail).toBe("orders, invoices");
    expect(checkUserChange({ actor: superAdmin, target, patch: { isActive: false }, ownedReports: ["orders"] })?.code).toBe("ownsReports");
    expect(checkUserChange({ actor: superAdmin, target, patch: { firstName: "New" }, ownedReports: ["orders"] })).toBeNull();
    expect(checkUserChange({ actor: superAdmin, target, patch: { role: "manager" }, ownedReports: [] })).toBeNull();
  });

  it("guards create and reset", () => {
    expect(checkCreate(superAdmin, "deny")?.code).toBe("invalid");
    expect(checkCreate(superAdmin, "super-admin")?.code).toBe("rootOnly");
    expect(checkCreate(root, "super-admin")).toBeNull();
    expect(checkReset(superAdmin, { ...target, isActive: false })?.code).toBe("inactiveUser");
    expect(checkReset(superAdmin, { ...target, role: "deny" })?.code).toBe("inactiveUser");
    expect(checkReset(superAdmin, target)).toBeNull();
  });

  it("always keeps the top role on a report list and rejects deny", () => {
    expect(normalizeReportRoles(["viewer", "viewer"])).toEqual(["super-admin", "viewer"]);
    expect(normalizeReportRoles([])).toEqual(["super-admin"]);
    expect(normalizeReportRoles(["deny"])).toBeNull();
  });
});

describe("validators", () => {
  const valid = { firstName: " Ada ", lastName: "L", username: "ada", email: "ada@example.com", role: "viewer" };

  it("validates a new user and never allows deny or unknown keys", () => {
    expect(createUserSchema.parse(valid).firstName).toBe("Ada");
    expect(createUserSchema.safeParse({ ...valid, role: "deny" }).success).toBe(false);
    expect(createUserSchema.safeParse({ ...valid, username: "a da" }).success).toBe(false);
    expect(createUserSchema.safeParse({ ...valid, email: "nope" }).success).toBe(false);
    expect(createUserSchema.safeParse({ ...valid, firstName: "x".repeat(101) }).success).toBe(false);
    expect(createUserSchema.safeParse({ ...valid, isRoot: true }).success).toBe(false);
    expect(userPatchSchema.safeParse({ role: "deny", isActive: false }).success).toBe(true);
  });

  it("counts password bytes, not characters", () => {
    expect(passwordProblem("short")).toBe("tooShort");
    expect(passwordProblem("a".repeat(72))).toBeNull();
    expect(passwordProblem("a".repeat(73))).toBe("tooLong");
    expect(passwordProblem("א".repeat(37))).toBe("tooLong");
    expect(passwordProblem(" padded ")).toBeNull();
  });

  it("accepts only same-origin relative return paths", () => {
    expect(safeReturnPath("/report/orders/summary?view=x#top")).toBe("/report/orders/summary?view=x#top");
    expect(safeReturnPath("/admin/users?x=1")).toBe("/admin/users?x=1");
    const refused = [
      "//evil.example",
      "/\\evil.example",
      "/\t/evil.example",
      "/\n/evil.example",
      "https://evil.example",
      "javascript:alert(1)",
      "%2F%2Fevil.example",
      "",
    ];
    for (const value of refused) expect(safeReturnPath(value), JSON.stringify(value)).toBe("/");
    expect(safeReturnPath(null)).toBe("/");
    expect(safeReturnPath(undefined)).toBe("/");
  });

  it("detects Hebrew input", () => {
    expect(hasHebrew("adminש")).toBe(true);
    expect(hasHebrew("admin")).toBe(false);
  });
});
