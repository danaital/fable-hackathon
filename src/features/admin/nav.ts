import { ADMIN_AREA_MIN_ROLE, type Role } from "@/features/auth/roles";
import type { I18nKey } from "@/i18n/en";

export interface AdminNavItem {
  href: string;
  labelKey: I18nKey;
  /** Lowest role that sees the link. Hiding is not access control; each page and route checks again. */
  minRole: Role;
  /** Only the one protected top account. */
  rootOnly?: boolean;
}

export const ADMIN_HOME = "/admin/users";

/** Every admin route, in display order. */
export const ADMIN_NAV: readonly AdminNavItem[] = [
  { href: "/admin/users", labelKey: "admin.nav.users", minRole: ADMIN_AREA_MIN_ROLE },
  { href: "/admin/roles", labelKey: "admin.nav.roles", minRole: ADMIN_AREA_MIN_ROLE },
  { href: "/admin/password-requests", labelKey: "admin.nav.passwordRequests", minRole: ADMIN_AREA_MIN_ROLE, rootOnly: true },
  { href: "/admin/report-access", labelKey: "admin.nav.reportAccess", minRole: ADMIN_AREA_MIN_ROLE },
  { href: "/admin/reports", labelKey: "admin.nav.reports", minRole: ADMIN_AREA_MIN_ROLE },
  { href: "/admin/fields", labelKey: "admin.nav.fields", minRole: ADMIN_AREA_MIN_ROLE },
  { href: "/admin/entities", labelKey: "admin.nav.entities", minRole: ADMIN_AREA_MIN_ROLE },
  { href: "/admin/relationships", labelKey: "admin.nav.relationships", minRole: ADMIN_AREA_MIN_ROLE },
  { href: "/admin/report-entities", labelKey: "admin.nav.reportEntities", minRole: ADMIN_AREA_MIN_ROLE },
  { href: "/admin/translations", labelKey: "admin.nav.translations", minRole: ADMIN_AREA_MIN_ROLE },
  { href: "/admin/versions", labelKey: "admin.nav.versions", minRole: ADMIN_AREA_MIN_ROLE, rootOnly: true },
  { href: "/admin/import-export", labelKey: "admin.nav.importExport", minRole: ADMIN_AREA_MIN_ROLE },
];
