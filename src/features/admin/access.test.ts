import { describe, expect, it } from "vitest";
import { demoSeed } from "@/features/auth/demoSeed";
import { accessDraftOf, ownerCandidates, sameRoles, toggleRole } from "./access";

const { users } = demoSeed();

describe("report access form", () => {
  it("starts a report without a list as closed to everyone but the top level", () => {
    expect(accessDraftOf(undefined)).toEqual({ roles: ["super-admin"], ownerUserId: null });
    expect(accessDraftOf({ reportId: "orders", roles: ["viewer"], ownerUserId: "demo-admin" })).toEqual({ roles: ["super-admin", "viewer"], ownerUserId: "demo-admin" });
  });

  it("toggles a level but never removes the top level", () => {
    expect(toggleRole(["super-admin"], "viewer")).toEqual(["super-admin", "viewer"]);
    expect(toggleRole(["super-admin", "viewer"], "viewer")).toEqual(["super-admin"]);
    expect(toggleRole(["super-admin"], "super-admin")).toEqual(["super-admin"]);
  });

  it("compares role lists as sets", () => {
    expect(sameRoles(["super-admin", "viewer"], ["viewer", "super-admin"])).toBe(true);
    expect(sameRoles(["super-admin"], ["super-admin", "viewer"])).toBe(false);
  });

  it("offers active admins and above as owners, and always keeps the current owner", () => {
    expect(ownerCandidates(users, null).map((user) => user.id)).toEqual(["demo-root", "demo-admin"]);
    expect(ownerCandidates(users, "demo-viewer").map((user) => user.id)).toEqual(["demo-root", "demo-admin", "demo-viewer"]);
  });
});
