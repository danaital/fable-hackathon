import { describe, expect, it } from "vitest";
import { demoSeed } from "@/features/auth/demoSeed";
import type { AuthUser } from "@/features/auth/model";
import type { Actor } from "@/features/auth/rules";
import { changedPatch, draftOf, invalidFields, roleOptions, userLocks } from "./users";

const seed = demoSeed();
const user = (id: string): AuthUser => {
  const found = seed.users.find((item) => item.id === id);
  if (!found) throw new Error(`no seed user ${id}`);
  return found;
};
const root: Actor = { id: "demo-root", role: "super-admin", isRoot: true };
const otherSuperAdmin: Actor = { id: "someone", role: "super-admin", isRoot: false };
const locks = (actor: Actor, id: string) => userLocks({ actor, target: user(id), access: seed.reportAccess });

describe("userLocks", () => {
  it("locks your own row", () => {
    expect(locks(root, "demo-root")).toMatchObject({ edit: { code: "selfChange" }, status: { code: "selfChange" }, reset: { code: "selfChange" } });
  });

  it("locks the root account for everyone else", () => {
    expect(locks(otherSuperAdmin, "demo-root").edit?.code).toBe("rootProtected");
  });

  it("lets only root touch another super-admin", () => {
    const target = { ...user("demo-admin"), role: "super-admin" as const };
    expect(userLocks({ actor: otherSuperAdmin, target, access: [] }).edit?.code).toBe("rootOnly");
    expect(userLocks({ actor: root, target, access: [] }).edit).toBeNull();
  });

  it("refuses to deactivate a report owner and names the reports", () => {
    expect(locks(root, "demo-admin")).toMatchObject({ edit: null, status: { code: "ownsReports", detail: "orders" }, reset: null });
  });

  it("lets an inactive owner be reactivated", () => {
    const target = { ...user("demo-admin"), isActive: false };
    expect(userLocks({ actor: root, target, access: seed.reportAccess }).status).toBeNull();
  });

  it("refuses a reset link for blocked and inactive users", () => {
    expect(locks(root, "demo-blocked").reset?.code).toBe("inactiveUser");
    expect(locks(root, "demo-viewer")).toEqual({ edit: null, status: null, reset: null });
  });
});

describe("roleOptions", () => {
  it("offers the suspend role only when editing", () => {
    expect(roleOptions({ actor: root, editing: false }).map((option) => option.role)).not.toContain("deny");
    expect(roleOptions({ actor: root, editing: true }).map((option) => option.role)).toContain("deny");
  });

  it("disables super-admin unless the actor is root", () => {
    const top = (actor: Actor) => roleOptions({ actor, editing: true }).find((option) => option.role === "super-admin");
    expect(top(root)?.disabled).toBe(false);
    expect(top(otherSuperAdmin)?.disabled).toBe(true);
  });
});

describe("user form", () => {
  const viewer = user("demo-viewer");

  it("sends only the changed properties, trimmed", () => {
    expect(changedPatch(viewer, draftOf(viewer))).toEqual({});
    expect(changedPatch(viewer, { ...draftOf(viewer), firstName: " Vera ", lastName: "Vee", role: "manager" })).toEqual({ lastName: "Vee", role: "manager" });
  });

  it("names the fields that fail the shared schema", () => {
    expect(invalidFields(draftOf(viewer))).toEqual([]);
    expect(invalidFields({ ...draftOf(viewer), firstName: "  ", username: "two words", email: "nope" }).sort()).toEqual(["email", "firstName", "username"]);
  });
});
