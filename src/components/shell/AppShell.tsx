"use client";

import { Languages, Menu as MenuIcon, Moon, Sun, UserRound, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import styled, { css, useTheme } from "styled-components";
import { useThemeMode } from "@/app/providers";
import { Badge, Button, Link, Stack, Text, VisuallyHidden } from "@/components/ui";
import { useSession } from "@/features/auth/session";
import { useI18n } from "@/i18n";
import { Logo } from "./Logo";
import { NAV_ITEMS, isNavActive } from "./nav";

const MAIN_ID = "main-content";
const ICON_SIZE = 18;

const Header = styled.header`
  ${({ theme: { color, space, bp } }) => css`
    position: sticky;
    inset-block-start: 0;
    z-index: 10;
    display: flex;
    align-items: center;
    gap: ${space.lg};
    padding-block: ${space.sm};
    padding-inline: ${space.lg};
    background: ${color.surface};
    border-block-end: 1px solid ${color.border};
    @media (max-width: ${bp.mobile}) {
      flex-wrap: wrap;
      gap: ${space.sm};
      padding-inline: ${space.sm};
    }
  `}
`;

// On phones the links are a disclosure under the header: hidden (so out of the tab order) until the menu button opens it.
const Nav = styled.nav<{ $open: boolean }>`
  ${({ theme: { color, space, bp }, $open }) => css`
    display: flex;
    flex: 1 1 auto;
    gap: ${space.xs};
    @media (max-width: ${bp.mobile}) {
      display: ${$open ? "flex" : "none"};
      position: absolute;
      inset-block-start: 100%;
      inset-inline: 0;
      flex-direction: column;
      padding: ${space.sm};
      background: ${color.surface};
      border-block-end: 1px solid ${color.border};
    }
  `}
`;

const NavLink = styled(Link)`
  ${({ theme: { color, font, radius, size, space, bp } }) => css`
    display: inline-flex;
    align-items: center;
    gap: ${space.sm};
    min-block-size: ${size.control};
    padding-inline: ${space.md};
    border-block-end: 2px solid transparent;
    border-radius: ${radius.sm};
    font-size: ${font.size.sm};
    font-weight: ${font.weight.medium};
    &[aria-current="page"] {
      background: ${color.surfaceAlt};
      border-block-end-color: ${color.accent};
    }
    @media (max-width: ${bp.mobile}) {
      min-block-size: ${size.touch};
      font-size: ${font.size.md};
    }
  `}
`;

const MenuButton = styled(Button)`
  ${({ theme: { bp } }) => css`
    display: none;
    @media (max-width: ${bp.mobile}) {
      display: inline-flex;
    }
  `}
`;

const Tools = styled(Stack)`
  margin-inline-start: auto;
`;

const Main = styled.main`
  ${({ theme: { space, size, bp } }) => css`
    max-inline-size: ${size.content};
    margin-inline: auto;
    padding: ${space.xl};
    @media (max-width: ${bp.mobile}) {
      padding: ${space.md};
    }
  `}
`;

const SkipLink = styled.a`
  ${({ theme: { color, space, radius } }) => css`
    position: absolute;
    inset-inline-start: ${space.sm};
    inset-block-start: -100px;
    z-index: 20;
    padding: ${space.sm} ${space.md};
    border-radius: ${radius.sm};
    background: ${color.primary};
    color: ${color.onPrimary};
    &:focus {
      inset-block-start: ${space.sm};
    }
  `}
`;

const HideOnMobile = styled.span`
  ${({ theme: { bp } }) => css`
    @media (max-width: ${bp.mobile}) {
      display: none;
    }
  `}
`;

export function AppShell({ children }: { children: ReactNode }) {
  const { t, tData, locale, setLocale } = useI18n();
  const { mode, toggleMode } = useThemeMode();
  const isDark = mode === "dark";
  const { user, hasRole } = useSession();
  const pathname = usePathname();
  const { bp } = useTheme();
  const navId = useId();
  const menuButton = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const items = NAV_ITEMS.filter((item) => !item.minRole || hasRole(item.minRole));

  // Growing past the phone layout closes the menu, so it is not still open when the window shrinks again.
  useEffect(() => {
    const query = window.matchMedia(`(max-width: ${bp.mobile})`);
    const close = () => setMenuOpen(false);
    query.addEventListener("change", close);
    return () => query.removeEventListener("change", close);
  }, [bp.mobile]);

  const closeOnEscape = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== "Escape" || !menuOpen) return;
    setMenuOpen(false);
    menuButton.current?.focus();
  };

  return (
    <>
      <SkipLink href={`#${MAIN_ID}`}>{t("nav.skip")}</SkipLink>
      <Header onKeyDown={closeOnEscape}>
        <Link href="/" aria-label={t("app.name")}>
          <Stack $row $gap="sm">
            <Logo />
            <HideOnMobile>
              <Text $size="lg" $medium>
                {t("app.name")}
              </Text>
            </HideOnMobile>
          </Stack>
        </Link>
        <Nav id={navId} aria-label={t("nav.main")} $open={menuOpen}>
          {items.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              aria-current={isNavActive(pathname, item.href) ? "page" : undefined}
              onClick={() => setMenuOpen(false)}
            >
              {t(item.labelKey)}
            </NavLink>
          ))}
        </Nav>
        <Tools $row $gap="sm">
          <Button $variant="ghost" onClick={() => setLocale(locale === "he" ? "en" : "he")} lang={locale === "he" ? "en" : "he"}>
            <Languages size={ICON_SIZE} aria-hidden />
            <HideOnMobile>{t("lang.switchTo")}</HideOnMobile>
          </Button>
          <Button $variant="ghost" $icon onClick={toggleMode} aria-label={t(isDark ? "theme.toLight" : "theme.toDark")}>
            {isDark ? <Sun size={ICON_SIZE} aria-hidden /> : <Moon size={ICON_SIZE} aria-hidden />}
          </Button>
          {/* Fallback until "@/features/auth" exports UserMenu: name, user level and a profile link, always visible. */}
          {user ? (
            <>
              <NavLink href="/profile" aria-label={t("nav.profile", { name: user.name })} aria-current={isNavActive(pathname, "/profile") ? "page" : undefined}>
                <UserRound size={ICON_SIZE} aria-hidden />
                <HideOnMobile>{user.name}</HideOnMobile>
              </NavLink>
              <Badge $tone="info">
                <VisuallyHidden>{t("nav.userLevel")}</VisuallyHidden>
                {tData("role", user.role)}
              </Badge>
            </>
          ) : null}
          <MenuButton
            ref={menuButton}
            $variant="ghost"
            $icon
            aria-expanded={menuOpen}
            aria-controls={navId}
            aria-label={t(menuOpen ? "nav.menuClose" : "nav.menu")}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X size={ICON_SIZE} aria-hidden /> : <MenuIcon size={ICON_SIZE} aria-hidden />}
          </MenuButton>
        </Tools>
      </Header>
      <Main id={MAIN_ID}>{children}</Main>
    </>
  );
}
