import { DEMO_PASSWORD, type DemoState, type DemoUser } from "./demoSeed";
import {
  AuthError,
  authUserSchema,
  createUserSchema,
  displayName,
  signInSchema,
  userPatchSchema,
  type AuthUser,
  type PasswordRequest,
  type SessionUserData,
  type UserPatch,
} from "./model";
import { BASELINE, canOpenReport, countActions, permissionMapSchema, resolvePermissions, type PermissionMap, type ReportAccess } from "./permissions";
import { ROLES, type Role } from "./roles";
import { ADMIN_ROLE, canOwnReports, checkCreate, checkReset, checkRoleDefaultsEdit, checkUserChange, normalizeReportRoles } from "./rules";
import type { AccessibleReports, AuthStore } from "./store";

// LOCAL DEMO ADAPTER. Everything here runs in the browser against browser storage.
// It mirrors the server rules so the screens behave like the real thing, but it is NOT security:
// a visitor can edit the stored state by hand. Never present it as protection.

export interface DemoStorage {
  read: () => DemoState;
  write: (state: DemoState) => void;
}

const LIVE_REQUEST: readonly PasswordRequest["status"][] = ["pending", "approved"];

/** Drops the demo password: zod objects strip keys they do not declare. */
const strip = (user: DemoUser): AuthUser => authUserSchema.parse(user);

const sameText = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const canSignIn = (user: DemoUser) => user.isActive && user.role !== "deny";

/** The signed-in account, re-read from the stored users so deactivation and "deny" end the session at once. */
export function demoSessionUser(state: DemoState): SessionUserData | null {
  const user = state.users.find((item) => item.id === state.sessionUserId);
  if (!user || !canSignIn(user)) return null;
  const role: Role = user.isRoot ? ADMIN_ROLE : user.role;
  return {
    id: user.id,
    name: displayName(user),
    email: user.email,
    username: user.username,
    role,
    isRoot: user.isRoot,
    permissions: resolvePermissions({ role, isRoot: user.isRoot, roleDefaults: state.roleDefaults, overrides: user.permissionOverrides }),
  };
}

export function demoAccessibleReports(state: DemoState): AccessibleReports {
  const user = demoSessionUser(state);
  if (user?.role === ADMIN_ROLE) return { all: true, ids: [] };
  return { all: false, ids: state.reportAccess.filter((access) => canOpenReport(user, access)).map((access) => access.reportId) };
}

export function createDemoAuthStore(storage: DemoStorage, now: () => Date = () => new Date()): AuthStore {
  const actorOf = (state: DemoState): SessionUserData => {
    const actor = demoSessionUser(state);
    if (!actor) throw new AuthError("signedOut");
    return actor;
  };
  const rootOf = (state: DemoState): SessionUserData => {
    const actor = actorOf(state);
    if (!actor.isRoot) throw new AuthError("rootOnly");
    return actor;
  };
  const adminOf = (state: DemoState): SessionUserData => {
    const actor = actorOf(state);
    if (actor.role !== ADMIN_ROLE) throw new AuthError("forbidden");
    return actor;
  };
  const userOf = (state: DemoState, id: string): DemoUser => {
    const user = state.users.find((item) => item.id === id);
    if (!user) throw new AuthError("notFound");
    return user;
  };
  const refuse = (error: AuthError | null): void => {
    if (error) throw error;
  };
  const assertUnique = (state: DemoState, { id, email, username }: { id?: string; email?: string; username?: string }): void => {
    const others = state.users.filter((user) => user.id !== id);
    if (email !== undefined && others.some((user) => sameText(user.email, email))) throw new AuthError("emailTaken");
    if (username !== undefined && others.some((user) => sameText(user.username, username))) throw new AuthError("usernameTaken");
  };
  /** Issuing a new link cancels the user's other live links and pending requests. */
  const issue = (state: DemoState, request: Pick<PasswordRequest, "userId" | "purpose" | "status" | "decidedByUserId">): PasswordRequest[] => {
    const at = now().toISOString();
    const older = state.requests.map((item) =>
      item.userId === request.userId && LIVE_REQUEST.includes(item.status) ? { ...item, status: "superseded" as const } : item,
    );
    return [...older, { ...request, id: crypto.randomUUID(), requestedAt: at, decidedAt: request.decidedByUserId ? at : null }];
  };
  const accessOf = (state: DemoState, reportId: string): ReportAccess =>
    state.reportAccess.find((item) => item.reportId === reportId) ?? { reportId, roles: [ADMIN_ROLE], ownerUserId: null };
  const saveAccess = (state: DemoState, access: ReportAccess): ReportAccess => {
    storage.write({ ...state, reportAccess: [...state.reportAccess.filter((item) => item.reportId !== access.reportId), access] });
    return access;
  };

  const updateUser = async ({ id, patch: raw }: { id: string; patch: UserPatch }): Promise<AuthUser> => {
    const state = storage.read();
    const actor = adminOf(state);
    const parsed = userPatchSchema.safeParse(raw);
    if (!parsed.success) throw new AuthError("invalid");
    const patch = parsed.data;
    const target = userOf(state, id);
    const ownedReports = state.reportAccess.filter((access) => access.ownerUserId === id).map((access) => access.reportId);
    refuse(checkUserChange({ actor, target, patch, ownedReports }));
    assertUnique(state, { id, email: patch.email, username: patch.username });
    // A role change replaces the user's own permission changes with the new role's defaults.
    const roleChanged = patch.role !== undefined && patch.role !== target.role;
    const next: DemoUser = { ...target, ...patch, permissionOverrides: roleChanged ? {} : target.permissionOverrides };
    storage.write({ ...state, users: state.users.map((user) => (user.id === id ? next : user)) });
    return strip(next);
  };

  return {
    mode: "demo",

    async signIn(input) {
      const parsed = signInSchema.safeParse(input);
      const state = storage.read();
      const identifier = parsed.success ? parsed.data.identifier : "";
      const user = state.users.find((item) => sameText(item.email, identifier) || sameText(item.username, identifier));
      // One answer for every cause: wrong password, unknown account, blocked, inactive.
      if (!parsed.success || !user || user.password !== parsed.data.password || !canSignIn(user)) throw new AuthError("invalidCredentials");
      const next = { ...state, sessionUserId: user.id };
      storage.write(next);
      return actorOf(next);
    },
    async signOut() {
      storage.write({ ...storage.read(), sessionUserId: null });
    },
    async currentSession() {
      const state = storage.read();
      return { user: demoSessionUser(state), reports: demoAccessibleReports(state) };
    },
    subscribe: () => () => undefined, // the demo session is read straight from storage, which notifies on its own

    async listUsers() {
      const state = storage.read();
      adminOf(state);
      return state.users.map(strip).sort((a, b) => displayName(a).localeCompare(displayName(b)));
    },
    async createUser(input) {
      const state = storage.read();
      const actor = adminOf(state);
      const parsed = createUserSchema.safeParse(input);
      if (!parsed.success) throw new AuthError("invalid");
      refuse(checkCreate(actor, parsed.data.role));
      assertUnique(state, parsed.data);
      const user: DemoUser = {
        ...parsed.data,
        id: crypto.randomUUID(),
        isActive: true,
        isRoot: false,
        permissionOverrides: {},
        createdAt: now().toISOString(),
        password: DEMO_PASSWORD, // demo only: no email exists to deliver an invite link
      };
      const requests = issue(state, { userId: user.id, purpose: "invite", status: "approved", decidedByUserId: actor.id });
      storage.write({ ...state, users: [...state.users, user], requests });
      return { user: strip(user), inviteSent: false };
    },
    updateUser,
    deactivateUser: (id) => updateUser({ id, patch: { isActive: false } }),
    setRole: ({ id, role }) => updateUser({ id, patch: { role } }),
    async sendResetLink(id) {
      const state = storage.read();
      refuse(checkReset(adminOf(state), userOf(state, id)));
      storage.write({ ...state, requests: issue(state, { userId: id, purpose: "admin_reset", status: "approved", decidedByUserId: actorOf(state).id }) });
      return { emailSent: false };
    },

    async requestPasswordReset(identifier) {
      const state = storage.read();
      const text = identifier.trim();
      const user = state.users.find((item) => sameText(item.email, text) || sameText(item.username, text));
      // Unknown, inactive and "deny" accounts are ignored silently, and one pending request per user is enough.
      if (!user || !canSignIn(user)) return;
      if (state.requests.some((item) => item.userId === user.id && item.status === "pending")) return;
      // The approver's own request needs no approval.
      const status = user.isRoot ? "approved" : "pending";
      storage.write({ ...state, requests: issue(state, { userId: user.id, purpose: "forgot", status, decidedByUserId: user.isRoot ? user.id : null }) });
    },
    async listPasswordRequests() {
      const state = storage.read();
      rootOf(state);
      return state.requests
        .filter((request) => request.status === "pending")
        .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt))
        .flatMap((request) => {
          const user = state.users.find((item) => item.id === request.userId);
          return user ? [{ id: request.id, userId: user.id, name: displayName(user), username: user.username, email: user.email, requestedAt: request.requestedAt }] : [];
        });
    },
    async decidePasswordRequest({ id, decision }) {
      const state = storage.read();
      const actor = rootOf(state);
      const request = state.requests.find((item) => item.id === id && item.status === "pending");
      if (!request) throw new AuthError("notFound");
      const user = state.users.find((item) => item.id === request.userId);
      // Approving for a missing, inactive or "deny" user is refused and the request stays pending.
      if (decision === "approve" && (!user || !canSignIn(user))) throw new AuthError("inactiveUser");
      const status = decision === "approve" ? "approved" : "rejected";
      const decided: PasswordRequest = { ...request, status, decidedByUserId: actor.id, decidedAt: now().toISOString() };
      storage.write({ ...state, requests: state.requests.map((item) => (item.id === id ? decided : item)) });
      return { emailSent: false };
    },

    async getRoleDefaults() {
      const state = storage.read();
      adminOf(state);
      return Object.fromEntries(ROLES.map((role) => [role, state.roleDefaults[role] ?? BASELINE[role]])) as Record<Role, PermissionMap>;
    },
    async setRoleDefaults({ role, permissions }) {
      const state = storage.read();
      refuse(checkRoleDefaultsEdit(actorOf(state), role));
      const parsed = permissionMapSchema.safeParse(permissions);
      if (!parsed.success || countActions(parsed.data) === 0) throw new AuthError("invalid");
      storage.write({ ...state, roleDefaults: { ...state.roleDefaults, [role]: parsed.data } });
      return parsed.data;
    },

    async listReportAccess() {
      const state = storage.read();
      adminOf(state);
      return state.reportAccess;
    },
    async setReportRoles({ reportId, roles }) {
      const state = storage.read();
      adminOf(state);
      const normalized = normalizeReportRoles(roles);
      if (!normalized) throw new AuthError("invalid");
      return saveAccess(state, { ...accessOf(state, reportId), roles: normalized });
    },
    async setReportOwner({ reportId, userId }) {
      const state = storage.read();
      adminOf(state);
      if (userId !== null && !canOwnReports(userOf(state, userId))) throw new AuthError("invalid");
      return saveAccess(state, { ...accessOf(state, reportId), ownerUserId: userId });
    },
    async deleteReportAccess(reportId) {
      const state = storage.read();
      adminOf(state);
      storage.write({ ...state, reportAccess: state.reportAccess.filter((item) => item.reportId !== reportId) });
    },
  };
}
