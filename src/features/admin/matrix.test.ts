import { describe, expect, it } from "vitest";
import { BASELINE, toggleAction } from "@/features/auth/permissions";
import type { Actor } from "@/features/auth/rules";
import { changedRoles, editableRoles, sameMap, withBuiltInDefaults } from "./matrix";

const root: Actor = { id: "r", role: "super-admin", isRoot: true };
const superAdmin: Actor = { id: "s", role: "super-admin", isRoot: false };
const edited = { ...BASELINE, viewer: toggleAction(BASELINE.viewer, { feature: "reports", action: "export" }) };

describe("role matrix", () => {
  it("compares permission maps without caring about order or empty features", () => {
    expect(sameMap({ reports: ["view", "export"] }, { reports: ["export", "view"], views: [] })).toBe(true);
    expect(sameMap({ reports: ["view"] }, { reports: ["view", "export"] })).toBe(false);
  });

  it("lists only the columns that differ from the stored ones", () => {
    expect(changedRoles(BASELINE, BASELINE)).toEqual([]);
    expect(changedRoles(BASELINE, edited)).toEqual(["viewer"]);
  });

  it("keeps the top column read-only unless the actor is root", () => {
    expect(editableRoles(root)).toContain("super-admin");
    expect(editableRoles(superAdmin)).toEqual(["admin", "manager", "supervisor", "viewer"]);
    expect(editableRoles({ id: "m", role: "manager", isRoot: false })).toEqual([]);
  });

  it("resets only the given columns to the built-in defaults", () => {
    const both = { ...edited, admin: { reports: ["view"] } };
    const reset = withBuiltInDefaults(both, ["viewer"]);
    expect(reset.viewer).toEqual(BASELINE.viewer);
    expect(reset.admin).toEqual({ reports: ["view"] });
  });
});
