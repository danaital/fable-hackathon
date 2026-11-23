import type { Role } from "@/features/auth/session";
import type { I18nKey } from "@/i18n";

export interface NavItem {
  href: string;
  labelKey: I18nKey;
  /** Lowest role that sees the link. Absent means everyone. Hiding is not access control; routes check on the server. */
  minRole?: Role;
}

/** Array order is display order. */
export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/", labelKey: "nav.reports" },
  { href: "/views", labelKey: "nav.views" },
  { href: "/settings", labelKey: "nav.settings" },
  { href: "/admin", labelKey: "nav.admin", minRole: "manager" },
  { href: "/about", labelKey: "nav.about" },
];

const HOME = "/";

/** A link is current when the path is its route or one of its child routes. Home only matches itself. */
export function isNavActive(pathname: string, href: string): boolean {
  return pathname === href || (href !== HOME && pathname.startsWith(`${href}/`));
}
