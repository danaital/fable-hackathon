"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import styled, { css } from "styled-components";
import { Heading, Link, Notice, Select, Stack, Text, VisuallyHidden } from "@/components/ui";
import { DemoBanner } from "@/features/auth/UserMenu";
import { ADMIN_AREA_MIN_ROLE } from "@/features/auth/roles";
import { RequireRole, useSession } from "@/features/auth/session";
import { useI18n } from "@/i18n";
import { useRouter } from "next/navigation";
import { ADMIN_NAV } from "./nav";

const NAV_SELECT_ID = "admin-nav-select";

const Layout = styled.div`
  ${({ theme: { space, bp } }) => css`
    display: grid;
    grid-template-columns: 220px minmax(0, 1fr);
    gap: ${space.xl};
    align-items: start;
    @media (max-width: ${bp.mobile}) {
      grid-template-columns: minmax(0, 1fr);
      gap: ${space.md};
    }
  `}
`;

const Side = styled.nav`
  ${({ theme: { space, bp } }) => css`
    display: flex;
    flex-direction: column;
    gap: ${space.xs};
    @media (max-width: ${bp.mobile}) {
      display: none;
    }
  `}
`;

const SideLink = styled(Link)<{ $current: boolean }>`
  ${({ theme: { color, font, radius, size, space }, $current }) => css`
    display: flex;
    align-items: center;
    min-block-size: ${size.control};
    padding-inline: ${space.md};
    border-radius: ${radius.sm};
    font-size: ${font.size.sm};
    font-weight: ${$current ? font.weight.medium : font.weight.regular};
    background: ${$current ? color.surfaceAlt : "transparent"};
  `}
`;

const PhoneNav = styled.div`
  ${({ theme: { bp } }) => css`
    display: none;
    @media (max-width: ${bp.mobile}) {
      display: block;
    }
  `}
`;

const FullSelect = styled(Select)`
  inline-size: 100%;
`;

/** Admin area frame: side navigation (a menu on phones), demo banner and the role guard. */
export function AdminShell({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const { user, hasRole } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const items = ADMIN_NAV.filter((item) => hasRole(item.minRole) && (!item.rootOnly || user?.isRoot));
  const isCurrent = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Stack $gap="lg">
      <Heading>{t("admin.title")}</Heading>
      <DemoBanner />
      <RequireRole min={ADMIN_AREA_MIN_ROLE}>
        <Layout>
          <Side aria-label={t("admin.nav.label")}>
            {items.map((item) => (
              <SideLink key={item.href} href={item.href} $current={isCurrent(item.href)} aria-current={isCurrent(item.href) ? "page" : undefined}>
                {t(item.labelKey)}
              </SideLink>
            ))}
          </Side>
          <PhoneNav>
            <VisuallyHidden as="label" htmlFor={NAV_SELECT_ID}>
              {t("admin.nav.label")}
            </VisuallyHidden>
            <FullSelect id={NAV_SELECT_ID} value={items.find((item) => isCurrent(item.href))?.href ?? ""} onChange={(event) => router.push(event.target.value)}>
              {items.map((item) => (
                <option key={item.href} value={item.href}>
                  {t(item.labelKey)}
                </option>
              ))}
            </FullSelect>
          </PhoneNav>
          <Stack $gap="lg">{children}</Stack>
        </Layout>
      </RequireRole>
    </Stack>
  );
}

/** Placeholder for an admin screen that is not built yet. */
export function AdminComingSoon({ titleKey }: { titleKey: (typeof ADMIN_NAV)[number]["labelKey"] }) {
  const { t } = useI18n();
  return (
    <Stack $gap="md">
      <Heading as="h2" $size="lg">
        {t(titleKey)}
      </Heading>
      <Notice role="status">
        <Text>{t("admin.comingSoon")}</Text>
      </Notice>
    </Stack>
  );
}
