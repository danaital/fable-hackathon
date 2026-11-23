"use client";

import { CircleCheck, CircleX, KeyRound, Plus, Settings, UserCheck, UserX } from "lucide-react";
import { useCallback, useState } from "react";
import { Badge, Button, Link, Ltr, Paragraph, Stack, Text, useToast } from "@/components/ui";
import { AuthError, createUserSchema, displayName, type AuthUser } from "@/features/auth/model";
import { ROLE_TONE, roleLabelKey } from "@/features/auth/roles";
import { useAuthStore, useSession } from "@/features/auth/session";
import { useI18n } from "@/i18n";
import { ALL_ROWS, LoadView, ScreenHeader, Toolbar, contains, useAction, useLoad } from "./kit";
import { DataTable, type Column } from "./tools/table";
import { ConfirmDialog, ICON_SIZE, IconButton } from "./tools/ui";
import { UserDialog, type UserDialogRequest } from "./UserDialog";
import { changedPatch, userLocks, type UserDraft, type UserLocks } from "./users";

type ConfirmKind = "deactivate" | "reset";

interface Row {
  user: AuthUser;
  locks: UserLocks;
}

/** One line per distinct reason an action on the row is disabled. */
function lockReasons(locks: UserLocks): AuthError[] {
  const seen = new Map<string, AuthError>();
  for (const lock of [locks.edit, locks.status, locks.reset]) if (lock && !seen.has(lock.code)) seen.set(lock.code, lock);
  return [...seen.values()];
}

/** Users: list, create, edit profile and level, deactivate or reactivate, send a reset link. */
export function UsersScreen() {
  const { t } = useI18n();
  const store = useAuthStore();
  const { user: actor } = useSession();
  const toast = useToast();
  const load = useLoad(
    useCallback(async () => {
      const [users, access, roleDefaults] = await Promise.all([store.listUsers(), store.listReportAccess(), store.getRoleDefaults()]);
      return { users, access, roleDefaults };
    }, [store]),
  );
  const { busy, run } = useAction(load.reload);
  const [query, setQuery] = useState("");
  const [dialog, setDialog] = useState<UserDialogRequest | null>(null);
  const [confirm, setConfirm] = useState<{ kind: ConfirmKind; user: AuthUser } | null>(null);
  if (!actor) return null;

  const save = async (draft: UserDraft) => {
    const target = dialog?.user;
    const saved = await run(async () => {
      if (target) {
        await store.updateUser({ id: target.id, patch: changedPatch(target, draft) });
        toast.success({ title: "admin.users.saved", titleVars: { name: displayName({ ...target, ...draft }) } });
        return;
      }
      const input = createUserSchema.safeParse(draft);
      if (!input.success) throw new AuthError("invalid");
      const { user, inviteSent } = await store.createUser(input.data);
      // No email service in demo mode: the user exists, the invite was not sent.
      toast[inviteSent ? "success" : "warning"]({ title: inviteSent ? "admin.users.created" : "admin.users.createdNoInvite", titleVars: { name: displayName(user) } });
    });
    if (saved) setDialog(null);
  };

  const setActive = (user: AuthUser, isActive: boolean) =>
    run(async () => {
      await store.updateUser({ id: user.id, patch: { isActive } });
      toast.success({ title: isActive ? "admin.users.reactivated" : "admin.users.deactivated", titleVars: { name: displayName(user) } });
    });

  const sendReset = (user: AuthUser) =>
    run(async () => {
      const { emailSent } = await store.sendResetLink(user.id);
      toast[emailSent ? "success" : "warning"]({ title: emailSent ? "admin.users.resetSent" : "admin.users.resetNoEmail", titleVars: { email: user.email } });
    });

  const confirmed = async () => {
    if (!confirm) return;
    const done = await (confirm.kind === "deactivate" ? setActive(confirm.user, false) : sendReset(confirm.user));
    if (done) setConfirm(null);
  };

  const columns: Column<Row>[] = [
    { key: "name", header: t("admin.users.name"), cell: ({ user }) => <Text $medium>{displayName(user)}</Text> },
    { key: "username", header: t("admin.users.username"), cell: ({ user }) => <Ltr>{user.username}</Ltr> },
    {
      key: "email",
      header: t("admin.users.email"),
      cell: ({ user }) => (
        <Link href={`mailto:${user.email}`}>
          <Ltr>{user.email}</Ltr>
        </Link>
      ),
    },
    { key: "role", header: t("auth.level"), cell: ({ user }) => <Badge $tone={ROLE_TONE[user.role]}>{t(roleLabelKey(user.role))}</Badge> },
    {
      key: "status",
      header: t("admin.users.status"),
      cell: ({ user }) => (
        <Badge $tone={user.isActive ? "success" : "neutral"}>
          {user.isActive ? <CircleCheck size={ICON_SIZE} aria-hidden /> : <CircleX size={ICON_SIZE} aria-hidden />}
          {t(user.isActive ? "admin.users.active" : "admin.users.inactive")}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: t("admin.actions"),
      cell: ({ user, locks }) => {
        const name = displayName(user);
        return (
          <Stack $gap="xs" $align="start">
            <Stack $row $gap="xs">
              <IconButton label={t("admin.users.edit", { name })} icon={Settings} onClick={() => setDialog({ user, lock: locks.edit })} />
              {user.isActive ? (
                <IconButton label={t("admin.users.deactivate", { name })} icon={UserX} disabled={busy || locks.status !== null} onClick={() => setConfirm({ kind: "deactivate", user })} />
              ) : (
                <IconButton label={t("admin.users.reactivate", { name })} icon={UserCheck} disabled={busy || locks.status !== null} onClick={() => void setActive(user, true)} />
              )}
              <IconButton label={t("admin.users.reset", { name })} icon={KeyRound} disabled={busy || locks.reset !== null} onClick={() => setConfirm({ kind: "reset", user })} />
            </Stack>
            {lockReasons(locks).map((lock) => (
              <Text key={lock.code} $muted $size="xs">
                {t(`auth.error.${lock.code}`)} {lock.detail ? <Ltr>{lock.detail}</Ltr> : null}
              </Text>
            ))}
          </Stack>
        );
      },
    },
  ];

  return (
    <Stack $gap="lg">
      <ScreenHeader titleKey="admin.nav.users" descKey="admin.users.desc" />
      <Toolbar search={{ value: query, onChange: setQuery, label: t("admin.users.search") }} onRefresh={load.reload}>
        <Button type="button" $variant="primary" onClick={() => setDialog({ user: null, lock: null })}>
          <Plus size={ICON_SIZE} aria-hidden />
          {t("admin.users.create")}
        </Button>
      </Toolbar>
      <LoadView load={load}>
        {({ users, access, roleDefaults }) => (
          <>
            <DataTable
              caption={t("admin.nav.users")}
              columns={columns}
              rows={users
                .filter((user) => contains(query, [displayName(user), user.username, user.email, user.role, t(roleLabelKey(user.role))]))
                .map((user) => ({ user, locks: userLocks({ actor, target: user, access }) }))}
              rowKey={({ user }) => user.id}
              empty={t(users.length === 0 ? "admin.users.empty" : "admin.noMatch")}
              pageSize={ALL_ROWS}
            />
            <UserDialog request={dialog} actor={actor} roleDefaults={roleDefaults} busy={busy} onClose={() => setDialog(null)} onSubmit={(draft) => void save(draft)} />
          </>
        )}
      </LoadView>
      <ConfirmDialog
        open={confirm !== null}
        danger={confirm?.kind === "deactivate"}
        title={t(confirm?.kind === "reset" ? "admin.users.resetTitle" : "admin.users.deactivateTitle")}
        confirmLabel={t(confirm?.kind === "reset" ? "admin.users.resetConfirm" : "admin.users.deactivateConfirm")}
        onConfirm={() => void confirmed()}
        onClose={() => setConfirm(null)}
      >
        <Paragraph>
          {confirm?.kind === "reset"
            ? t("admin.users.resetBody", { email: confirm.user.email })
            : t("admin.users.deactivateBody", { name: confirm ? displayName(confirm.user) : "" })}
        </Paragraph>
      </ConfirmDialog>
    </Stack>
  );
}
