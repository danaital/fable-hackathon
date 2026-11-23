"use client";

import { usePathname } from "next/navigation";
import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { Link, Notice, Text } from "@/components/ui";
import { useI18n } from "@/i18n";
import { createLocalStore } from "@/lib/store";
import { DEMO_STORAGE_KEY, demoSeed, demoStateSchema } from "./demoSeed";
import { createDemoAuthStore, demoAccessibleReports, demoSessionUser } from "./demoStore";
import { safeReturnPath, toAuthError, type SessionUserData } from "./model";
import { can, type Permission } from "./permissions";
import { roleAtLeast, type Role } from "./roles";
import type { AccessibleReports, AuthMode, AuthStore } from "./store";

// Session contract. Keep these export names and shapes; other features and route guards import them.
export { ROLES, roleAtLeast, type Role } from "./roles";

export type SessionUser = SessionUserData;
export type SessionStatus = "loading" | "signedIn" | "signedOut";

export interface Session {
  user: SessionUser | null;
  status: SessionStatus;
  /** True when the signed-in user's role is `min` or higher. Always false for "deny" and when signed out. */
  hasRole: (min: Role) => boolean;
}

export const LOGIN_PATH = "/login";
export const RETURN_PARAM = "next";
const HOME = "/";

// DEMO MODE: seeded accounts kept in this browser. Not real security (see demoStore.ts).
const demoStorage = createLocalStore(DEMO_STORAGE_KEY, demoStateSchema, demoSeed());
const demoAuthStore = createDemoAuthStore(demoStorage);

interface LiveSession {
  user: SessionUser | null;
  status: SessionStatus;
  reports: AccessibleReports | null;
}

/** Set only in supabase mode. Without it, hooks read the demo adapter. */
const ApiSessionContext = createContext<LiveSession | null>(null);

const noSubscription = () => () => undefined;
/** False during server render and hydration, so stored demo state never leaks into server HTML. */
const useHydrated = () => useSyncExternalStore(noSubscription, () => true, () => false);

function useLiveSession(): LiveSession {
  const api = useContext(ApiSessionContext);
  const demoState = demoStorage.useValue();
  const hydrated = useHydrated();
  return useMemo<LiveSession>(() => {
    if (api) return api;
    if (!hydrated) return { user: null, status: "loading", reports: null };
    const user = demoSessionUser(demoState);
    return { user, status: user ? "signedIn" : "signedOut", reports: demoAccessibleReports(demoState) };
  }, [api, demoState, hydrated]);
}

/**
 * Mount point for choosing the identity adapter. `mode` comes from the server (`getAuthMode()` in mode.ts).
 * shortcut: only the demo adapter is wired; "supabase" throws so it can never silently run as demo. Provide
 * ApiSessionContext from a server-backed adapter here when the Supabase project is authorized.
 */
export function SessionProvider({ mode, children }: { mode: AuthMode; children: ReactNode }) {
  if (mode !== "demo") throw new Error("AUTH_MODE=supabase is not wired yet: the Supabase adapter has not been built.");
  return <>{children}</>;
}

export function useSession(): Session {
  const { user, status } = useLiveSession();
  return useMemo(() => ({ user, status, hasRole: (min: Role) => user !== null && roleAtLeast(user.role, min) }), [user, status]);
}

export function useAuthStore(): AuthStore {
  return demoAuthStore;
}

/** True when the signed-in user holds the permission (feature + action). The server checks again; this only mirrors it. */
export function useCan(permission: Permission): boolean {
  return can(useSession().user, permission);
}

export interface ReportAccessCheck {
  /** While "loading", show a loader and nothing else (fail closed). */
  status: "loading" | "ready";
  canOpen: (reportId: string) => boolean;
}

/** Which reports the signed-in user may open. One rule for lists and for single reports. */
export function useReportAccess(): ReportAccessCheck {
  const { reports } = useLiveSession();
  return useMemo(
    () => ({ status: reports ? "ready" : "loading", canOpen: (reportId: string) => reports !== null && (reports.all || reports.ids.includes(reportId)) }),
    [reports],
  );
}

interface RequireRoleProps {
  min: Role;
  /** Also require the one protected top account. */
  rootOnly?: boolean;
  children: ReactNode;
}

/**
 * Renders children only for role `min` or higher. Signed-out visitors get a sign-in link that returns here;
 * a signed-in user without the role gets a notice. This mirrors the server check, it does not replace it.
 */
export function RequireRole({ min, rootOnly, children }: RequireRoleProps) {
  const { t } = useI18n();
  const { user, status, hasRole } = useSession();
  const pathname = usePathname();
  // No automatic redirect: a signed-out visitor gets a notice with a sign-in link that returns here.
  const loginHref = `${LOGIN_PATH}?${RETURN_PARAM}=${encodeURIComponent(safeReturnPath(pathname))}`;

  if (status === "loading") return <Notice role="status">{t("auth.checking")}</Notice>;
  if (status === "signedOut") {
    return (
      <Notice role="status">
        <Text>{t("auth.signInRequired")}</Text>
        <Link href={loginHref}>
          <Text $medium>{t("auth.signIn")}</Text>
        </Link>
      </Notice>
    );
  }
  if (!hasRole(min) || (rootOnly && !user?.isRoot)) {
    return (
      <Notice $tone="warning" role="alert">
        <Text>{t(rootOnly ? "auth.noAccessRoot" : "auth.noAccess")}</Text>
        <Link href={HOME}>
          <Text $medium>{t("auth.goHome")}</Text>
        </Link>
      </Notice>
    );
  }
  return <>{children}</>;
}

/** Turns a rejected store call into the translated reason, including its detail (e.g. the reports a user owns). */
export function useAuthErrorText(): (error: unknown) => string {
  const { t } = useI18n();
  return (error) => {
    const { code, detail } = toAuthError(error);
    return detail ? `${t(`auth.error.${code}`)} ${detail}` : t(`auth.error.${code}`);
  };
}
