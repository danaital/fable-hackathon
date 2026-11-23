import { z } from "zod";
import { REPORTS } from "@/data/reports";
import { authUserSchema, passwordRequestSchema, reportAccessSchema } from "./model";
import { permissionMapSchema } from "./permissions";
import { ASSIGNABLE_ROLES, ROLES, type Role } from "./roles";

// DEMO MODE ONLY. These accounts and this password live in the browser and are checked in the browser.
// This is NOT security: anyone can read or edit them. Real protection starts with the Supabase adapter.

/** Shared by every demo account and shown on the login page. Not a secret. */
export const DEMO_PASSWORD = "demo1234";
export const DEMO_STORAGE_KEY = "bahir.auth.demo.v1";
export const DEMO_ROOT_ID = "demo-root";
const SEEDED_AT = "2026-01-01T00:00:00.000Z";

const demoUserSchema = authUserSchema.extend({ password: z.string() });
export type DemoUser = z.infer<typeof demoUserSchema>;

export const demoStateSchema = z.object({
  users: z.array(demoUserSchema),
  sessionUserId: z.string().nullable(),
  roleDefaults: z.partialRecord(z.enum(ROLES), permissionMapSchema),
  reportAccess: z.array(reportAccessSchema),
  requests: z.array(passwordRequestSchema),
});
export type DemoState = z.infer<typeof demoStateSchema>;

interface SeedUser {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  role: Role;
  isRoot?: boolean;
}

// One account per role. The names are invented.
const SEED_USERS: readonly SeedUser[] = [
  { id: DEMO_ROOT_ID, firstName: "Tal", lastName: "Danai", username: "root", role: "super-admin", isRoot: true },
  { id: "demo-admin", firstName: "Adam", lastName: "Admin", username: "admin", role: "admin" },
  { id: "demo-manager", firstName: "Maya", lastName: "Manager", username: "manager", role: "manager" },
  { id: "demo-supervisor", firstName: "Sami", lastName: "Supervisor", username: "supervisor", role: "supervisor" },
  { id: "demo-viewer", firstName: "Vera", lastName: "Viewer", username: "viewer", role: "viewer" },
  { id: "demo-blocked", firstName: "Dov", lastName: "Blocked", username: "blocked", role: "deny" },
];

const OWNED_BY_DEMO_ADMIN = "orders";

export function demoSeed(): DemoState {
  return {
    users: SEED_USERS.map(({ isRoot = false, ...user }) => ({
      ...user,
      isRoot,
      email: `${user.username}@example.com`,
      isActive: true,
      permissionOverrides: {},
      createdAt: SEEDED_AT,
      password: DEMO_PASSWORD,
    })),
    // shortcut: a fresh demo browser starts signed in as the root account so the app stays demoable
    // without a login step; signing out sticks. Set to null to start signed out.
    sessionUserId: DEMO_ROOT_ID,
    roleDefaults: {},
    reportAccess: REPORTS.map((report) => ({
      reportId: report.id,
      roles: [...ASSIGNABLE_ROLES],
      ownerUserId: report.id === OWNED_BY_DEMO_ADMIN ? "demo-admin" : null,
    })),
    requests: [],
  };
}

/** Accounts listed on the login page banner, so a visitor can try each role. */
export const DEMO_ACCOUNTS: readonly { username: string; role: Role }[] = SEED_USERS.map(({ username, role }) => ({ username, role }));
