"use client";

import { ChevronDown, LogIn, LogOut, ShieldCheck, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, type FocusEvent, type KeyboardEvent } from "react";
import styled, { css } from "styled-components";
import { Badge, Button, Link, Notice, Stack, Text } from "@/components/ui";
import { useI18n } from "@/i18n";
import { ADMIN_AREA_MIN_ROLE, ROLE_TONE, roleLabelKey } from "./roles";
import { LOGIN_PATH, useAuthStore, useSession } from "./session";

const ICON_SIZE = 16;
const PROFILE_PATH = "/profile";
const ADMIN_PATH = "/admin";
const MAX_INITIALS = 2;

const Wrap = styled.div`
  position: relative;
`;

const Avatar = styled.span`
  ${({ theme: { color, font, size } }) => css`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    inline-size: calc(${size.control} - 8px);
    block-size: calc(${size.control} - 8px);
    border-radius: 50%;
    background: ${color.surfaceAlt};
    font-size: ${font.size.xs};
    font-weight: ${font.weight.medium};
    flex: none;
  `}
`;

const Name = styled(Text)`
  ${({ theme: { bp } }) => css`
    @media (max-width: ${bp.mobile}) {
      display: none;
    }
  `}
`;

const Panel = styled.div`
  ${({ theme: { color, radius, space } }) => css`
    position: absolute;
    inset-block-start: calc(100% + ${space.xs});
    inset-inline-end: 0;
    z-index: 20;
    display: flex;
    flex-direction: column;
    gap: ${space.xs};
    min-inline-size: 220px;
    padding: ${space.sm};
    border: 1px solid ${color.border};
    border-radius: ${radius.md};
    background: ${color.surface};
  `}
`;

const Item = styled(Link)`
  ${({ theme: { color, radius, size, space } }) => css`
    display: flex;
    align-items: center;
    gap: ${space.sm};
    min-block-size: ${size.touch};
    padding-inline: ${space.sm};
    border-radius: ${radius.sm};
    &:hover {
      background: ${color.surfaceAlt};
      text-decoration: none;
    }
  `}
`;

const ItemButton = styled(Button)`
  ${({ theme: { size } }) => css`
    justify-content: flex-start;
    min-block-size: ${size.touch};
  `}
`;

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, MAX_INITIALS)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/** Labels demo mode wherever sign-in or admin screens show: the demo adapter is not real security. */
export function DemoBanner() {
  const { t } = useI18n();
  const store = useAuthStore();
  if (store.mode !== "demo") return null;
  return (
    <Notice $tone="warning" role="note">
      <Text $size="sm">{t("auth.demo.banner")}</Text>
    </Notice>
  );
}

/** Header control: name and user level, with Profile, Admin (for admins) and Sign out. Shows a Sign in link when signed out. */
export function UserMenu() {
  const { t } = useI18n();
  const { user, status, hasRole } = useSession();
  const store = useAuthStore();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const panelId = useId();

  if (status === "loading") return null;
  if (!user) {
    return (
      <Item href={LOGIN_PATH}>
        <LogIn size={ICON_SIZE} aria-hidden />
        <Text $size="sm" $medium>
          {t("auth.signIn")}
        </Text>
      </Item>
    );
  }

  const close = () => setOpen(false);
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") close();
  };
  const onBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) close();
  };
  const signOut = async () => {
    close();
    await store.signOut();
    router.push(LOGIN_PATH);
  };

  return (
    <Wrap onKeyDown={onKeyDown} onBlur={onBlur}>
      <Button $variant="ghost" aria-expanded={open} aria-controls={panelId} aria-label={t("auth.menu.open", { name: user.name })} onClick={() => setOpen((value) => !value)}>
        <Avatar aria-hidden>{initials(user.name)}</Avatar>
        <Name $size="sm" $medium>
          {user.name}
        </Name>
        <Badge $tone={ROLE_TONE[user.role]} title={t("auth.level")}>
          {t(roleLabelKey(user.role))}
        </Badge>
        <ChevronDown size={ICON_SIZE} aria-hidden />
      </Button>
      {open ? (
        <Panel id={panelId}>
          <Stack $gap="xs">
            <Text $size="sm" $medium>
              {user.name}
            </Text>
            <Text $size="xs" $muted>
              {t("auth.level")}: {t(roleLabelKey(user.role))}
            </Text>
          </Stack>
          <Item href={PROFILE_PATH} onClick={close}>
            <UserRound size={ICON_SIZE} aria-hidden />
            <Text $size="sm">{t("auth.menu.profile")}</Text>
          </Item>
          {hasRole(ADMIN_AREA_MIN_ROLE) ? (
            <Item href={ADMIN_PATH} onClick={close}>
              <ShieldCheck size={ICON_SIZE} aria-hidden />
              <Text $size="sm">{t("auth.menu.admin")}</Text>
            </Item>
          ) : null}
          <ItemButton $variant="ghost" onClick={() => void signOut()}>
            <LogOut size={ICON_SIZE} aria-hidden />
            {t("auth.signOut")}
          </ItemButton>
        </Panel>
      ) : null}
    </Wrap>
  );
}
