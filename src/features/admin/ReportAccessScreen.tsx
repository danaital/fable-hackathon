"use client";

import { Settings } from "lucide-react";
import { useCallback, useState } from "react";
import { Badge, Checkbox, Field, Ltr, Select, Stack, Text, useToast } from "@/components/ui";
import { AuthError, displayName, reportAccessSchema, type AuthUser } from "@/features/auth/model";
import type { ReportAccess } from "@/features/auth/permissions";
import { ASSIGNABLE_ROLES, ROLE_TONE, roleLabelKey } from "@/features/auth/roles";
import { ADMIN_ROLE } from "@/features/auth/rules";
import { useAuthStore } from "@/features/auth/session";
import { useI18n } from "@/i18n";
import { accessDraftOf, ownerCandidates, sameRoles, toggleRole, type AccessDraft } from "./access";
import { ALL_ROWS, LoadView, ScreenHeader, Toolbar, contains, useAction, useDraft, useLoad } from "./kit";
import { useReportDefs } from "./registry";
import { DataTable, type Column } from "./tools/table";
import { FormDialog, IconButton, Option } from "./tools/ui";

const NO_OWNER = "";

interface Row {
  id: string;
  title: string;
  access: ReportAccess | undefined;
}

interface DialogProps {
  /** `null` keeps the dialog closed. */
  row: Row | null;
  users: readonly AuthUser[];
  busy: boolean;
  onClose: () => void;
  onSubmit: (draft: AccessDraft) => void;
}

function AccessDialog({ row, users, busy, onClose, onSubmit }: DialogProps) {
  const { t } = useI18n();
  const [draft, setDraft] = useDraft(row, (next) => accessDraftOf(next?.access));
  const initial = accessDraftOf(row?.access);
  const dirty = !sameRoles(initial.roles, draft.roles) || initial.ownerUserId !== draft.ownerUserId;
  const candidates = ownerCandidates(users, initial.ownerUserId);

  return (
    <FormDialog
      open={row !== null}
      title={t("admin.access.dialogTitle", { name: row?.title ?? "" })}
      dirty={dirty}
      onClose={onClose}
      onSubmit={() => onSubmit(draft)}
      submitLabel={t(busy ? "admin.saving" : "action.save")}
      submitDisabled={busy || !dirty}
    >
      <Stack $gap="sm" role="group" aria-label={t("admin.access.roles")}>
        <Text $medium>{t("admin.access.roles")}</Text>
        {ASSIGNABLE_ROLES.map((role) => (
          <Checkbox key={role} checked={draft.roles.includes(role)} disabled={busy || role === ADMIN_ROLE} onChange={() => setDraft({ ...draft, roles: toggleRole(draft.roles, role) })}>
            {t(roleLabelKey(role))}
          </Checkbox>
        ))}
        <Text $muted $size="xs">
          {t("admin.access.rolesHint")}
        </Text>
      </Stack>
      <Field label={t("admin.access.owner")} hint={t("admin.access.ownerHint")}>
        {(id) => (
          <Select
            id={id}
            disabled={busy}
            value={draft.ownerUserId ?? NO_OWNER}
            // The picked value is looked up in the offered list; anything else clears the owner.
            onChange={(event) => setDraft({ ...draft, ownerUserId: candidates.find((user) => user.id === event.target.value)?.id ?? null })}
          >
            <Option value={NO_OWNER}>{t("admin.access.noOwner")}</Option>
            {candidates.map((user) => (
              <Option key={user.id} value={user.id}>
                {t("admin.access.ownerOption", { name: displayName(user), email: user.email })}
              </Option>
            ))}
          </Select>
        )}
      </Field>
    </FormDialog>
  );
}

/** Per report: which levels may open it, and who owns it. */
export function ReportAccessScreen() {
  const { t } = useI18n();
  const store = useAuthStore();
  const toast = useToast();
  const reports = useReportDefs();
  const load = useLoad(
    useCallback(async () => {
      const [access, users] = await Promise.all([store.listReportAccess(), store.listUsers()]);
      return { access, users };
    }, [store]),
  );
  const { busy, run } = useAction(load.reload);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Row | null>(null);

  const save = async (draft: AccessDraft) => {
    if (!editing) return;
    const initial = accessDraftOf(editing.access);
    const saved = await run(async () => {
      const input = reportAccessSchema.safeParse({ reportId: editing.id, ...draft });
      if (!input.success) throw new AuthError("invalid");
      const { reportId, roles, ownerUserId } = input.data;
      // Only what the admin changed is written.
      if (!sameRoles(initial.roles, roles)) await store.setReportRoles({ reportId, roles });
      if (initial.ownerUserId !== ownerUserId) await store.setReportOwner({ reportId, userId: ownerUserId });
      toast.success({ title: "admin.access.saved", titleVars: { name: editing.title } });
    });
    if (saved) setEditing(null);
  };

  return (
    <Stack $gap="lg">
      <ScreenHeader titleKey="admin.nav.reportAccess" descKey="admin.access.desc" />
      <Toolbar search={{ value: query, onChange: setQuery, label: t("admin.access.search") }} onRefresh={load.reload} />
      <LoadView load={load}>
        {({ access, users }) => {
          const columns: Column<Row>[] = [
            { key: "title", header: t("admin.report.title"), cell: (row) => <Text $medium>{row.title}</Text> },
            { key: "id", header: t("admin.report.id"), cell: (row) => <Ltr>{row.id}</Ltr> },
            {
              key: "roles",
              header: t("admin.access.roles"),
              cell: (row) => (
                <Stack $row $wrap $gap="xs">
                  {ASSIGNABLE_ROLES.filter((role) => accessDraftOf(row.access).roles.includes(role)).map((role) => (
                    <Badge key={role} $tone={ROLE_TONE[role]}>
                      {t(roleLabelKey(role))}
                    </Badge>
                  ))}
                </Stack>
              ),
            },
            {
              key: "owner",
              header: t("admin.access.owner"),
              cell: (row) => {
                const owner = users.find((user) => user.id === row.access?.ownerUserId);
                return owner ? <Badge title={owner.email}>{displayName(owner)}</Badge> : <Text $muted>{t("admin.access.noOwner")}</Text>;
              },
            },
            {
              key: "actions",
              header: t("admin.actions"),
              cell: (row) => <IconButton label={t("admin.access.edit", { name: row.title })} icon={Settings} disabled={busy} onClick={() => setEditing(row)} />,
            },
          ];
          const rows = reports.map((report): Row => ({ id: report.id, title: report.title, access: access.find((item) => item.reportId === report.id) }));
          return (
            <>
              <DataTable
                caption={t("admin.nav.reportAccess")}
                columns={columns}
                rows={rows.filter((row) => contains(query, [row.id, row.title]))}
                rowKey={(row) => row.id}
                empty={t("admin.noMatch")}
                pageSize={ALL_ROWS}
              />
              <AccessDialog row={editing} users={users} busy={busy} onClose={() => setEditing(null)} onSubmit={(draft) => void save(draft)} />
            </>
          );
        }}
      </LoadView>
    </Stack>
  );
}
