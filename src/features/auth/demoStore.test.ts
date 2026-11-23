import { beforeEach, describe, expect, it } from "vitest";
import { DEMO_PASSWORD, DEMO_ROOT_ID, demoSeed, type DemoState } from "./demoSeed";
import { createDemoAuthStore, demoAccessibleReports, demoSessionUser } from "./demoStore";
import type { AuthStore } from "./store";

let state: DemoState;
let store: AuthStore;
const signInAs = (identifier: string) => store.signIn({ identifier, password: DEMO_PASSWORD });
const newUser = { firstName: "Noa", lastName: "New", username: "noa", email: "noa@example.com", role: "viewer" } as const;

beforeEach(() => {
  state = { ...demoSeed(), sessionUserId: null };
  store = createDemoAuthStore({ read: () => state, write: (next) => void (state = next) }, () => new Date("2026-02-02T10:00:00Z"));
});

describe("demo adapter: session", () => {
  it("signs in by username or email, case-insensitively, and signs out", async () => {
    expect((await signInAs("MANAGER@example.com")).role).toBe("manager");
    expect((await signInAs("viewer")).username).toBe("viewer");
    await store.signOut();
    expect((await store.currentSession()).user).toBeNull();
  });

  it("gives one generic refusal for wrong password, unknown, blocked and inactive accounts", async () => {
    await expect(store.signIn({ identifier: "viewer", password: "wrong-password" })).rejects.toMatchObject({ code: "invalidCredentials" });
    await expect(signInAs("nobody")).rejects.toMatchObject({ code: "invalidCredentials" });
    await expect(signInAs("blocked")).rejects.toMatchObject({ code: "invalidCredentials" });
    await expect(store.signIn({ identifier: "", password: "" })).rejects.toMatchObject({ code: "invalidCredentials" });
  });

  it("ends a live session as soon as the account is deactivated", async () => {
    await signInAs("viewer");
    state = { ...state, users: state.users.map((user) => (user.username === "viewer" ? { ...user, isActive: false } : user)) };
    expect(demoSessionUser(state)).toBeNull();
  });

  it("never returns the demo password", async () => {
    await signInAs("root");
    expect(JSON.stringify(await store.listUsers())).not.toContain(DEMO_PASSWORD);
    expect(JSON.stringify(await store.createUser(newUser))).not.toContain(DEMO_PASSWORD);
  });
});

describe("demo adapter: users", () => {
  it("refuses admin calls from signed-out users and lower roles", async () => {
    await expect(store.listUsers()).rejects.toMatchObject({ code: "signedOut" });
    await signInAs("admin");
    await expect(store.listUsers()).rejects.toMatchObject({ code: "forbidden" });
    await expect(store.createUser(newUser)).rejects.toMatchObject({ code: "forbidden" });
  });

  it("creates an active user, rejects duplicates without case, and lets the new user sign in", async () => {
    await signInAs("root");
    const { user, inviteSent } = await store.createUser(newUser);
    expect(user.isActive).toBe(true);
    expect(inviteSent).toBe(false);
    await expect(store.createUser({ ...newUser, username: "other" })).rejects.toMatchObject({ code: "emailTaken" });
    await expect(store.createUser({ ...newUser, email: "x@example.com", username: "NOA" })).rejects.toMatchObject({ code: "usernameTaken" });
    expect((await signInAs("noa")).id).toBe(user.id);
  });

  it("applies the protection rules on edit", async () => {
    await signInAs("root");
    await expect(store.setRole({ id: DEMO_ROOT_ID, role: "viewer" })).rejects.toMatchObject({ code: "selfChange" });
    await expect(store.deactivateUser("demo-admin")).rejects.toMatchObject({ code: "ownsReports", detail: "orders" });
    expect((await store.setRole({ id: "demo-viewer", role: "deny" })).role).toBe("deny");
    await expect(signInAs("viewer")).rejects.toMatchObject({ code: "invalidCredentials" });
  });

  it("wipes per-user permission changes on a role change", async () => {
    state = { ...state, users: state.users.map((user) => (user.id === "demo-viewer" ? { ...user, permissionOverrides: { views: ["view", "create"] } } : user)) };
    await signInAs("root");
    expect((await store.updateUser({ id: "demo-viewer", patch: { firstName: "V" } })).permissionOverrides).toEqual({ views: ["view", "create"] });
    expect((await store.setRole({ id: "demo-viewer", role: "manager" })).permissionOverrides).toEqual({});
  });
});

describe("demo adapter: password requests", () => {
  it("keeps one pending request per user, ignores unknown accounts, and is root only", async () => {
    await store.requestPasswordReset("viewer@example.com");
    await store.requestPasswordReset("viewer");
    await store.requestPasswordReset("nobody");
    await store.requestPasswordReset("blocked");
    expect(state.requests.filter((request) => request.status === "pending")).toHaveLength(1);

    await signInAs("root");
    const [request] = await store.listPasswordRequests();
    expect(request.username).toBe("viewer");
    expect(await store.decidePasswordRequest({ id: request.id, decision: "approve" })).toEqual({ emailSent: false });
    expect(await store.listPasswordRequests()).toEqual([]);
    expect(state.requests[0]).toMatchObject({ status: "approved", decidedByUserId: DEMO_ROOT_ID });
    await expect(store.decidePasswordRequest({ id: request.id, decision: "reject" })).rejects.toMatchObject({ code: "notFound" });
  });

  it("refuses the queue to a super-admin who is not root", async () => {
    await signInAs("root");
    await store.createUser({ ...newUser, role: "super-admin" });
    await signInAs("noa");
    await expect(store.listPasswordRequests()).rejects.toMatchObject({ code: "rootOnly" });
  });

  it("keeps a request pending when its user became inactive", async () => {
    await store.requestPasswordReset("viewer");
    await signInAs("root");
    await store.deactivateUser("demo-viewer");
    const [request] = await store.listPasswordRequests();
    await expect(store.decidePasswordRequest({ id: request.id, decision: "approve" })).rejects.toMatchObject({ code: "inactiveUser" });
    expect((await store.listPasswordRequests())).toHaveLength(1);
  });
});

describe("demo adapter: role defaults and report access", () => {
  it("stores a role's defaults and applies them to that role's users at once", async () => {
    await signInAs("root");
    await store.setRoleDefaults({ role: "viewer", permissions: { reports: ["view", "export"] } });
    await expect(store.setRoleDefaults({ role: "viewer", permissions: {} })).rejects.toMatchObject({ code: "invalid" });
    await expect(store.setRoleDefaults({ role: "deny", permissions: { reports: ["view"] } })).rejects.toMatchObject({ code: "invalid" });
    expect((await signInAs("viewer")).permissions).toEqual({ reports: ["view", "export"] });
  });

  it("keeps the top role on every list, validates owners, and filters accessible reports by exact role", async () => {
    await signInAs("root");
    expect((await store.setReportRoles({ reportId: "orders", roles: ["viewer"] })).roles).toEqual(["super-admin", "viewer"]);
    await expect(store.setReportRoles({ reportId: "orders", roles: ["deny"] })).rejects.toMatchObject({ code: "invalid" });
    await expect(store.setReportOwner({ reportId: "invoices", userId: "demo-viewer" })).rejects.toMatchObject({ code: "invalid" });
    expect((await store.setReportOwner({ reportId: "invoices", userId: "demo-admin" })).ownerUserId).toBe("demo-admin");
    expect(demoAccessibleReports(state)).toEqual({ all: true, ids: [] });

    await signInAs("manager");
    expect(demoAccessibleReports(state).ids).not.toContain("orders");
    await signInAs("admin");
    expect(demoAccessibleReports(state).ids).toContain("orders"); // owner, although the role is not on the list
  });
});
