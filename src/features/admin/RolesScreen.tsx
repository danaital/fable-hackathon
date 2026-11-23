"use client";

import { RotateCcw, Save } from "lucide-react";
import { useCallback, useState } from "react";
import { Button, Checkbox, Notice, Stack, Text, VisuallyHidden, useToast } from "@/components/ui";
import { MATRIX_ROLES, MATRIX_ROWS, toggleAction, type Permission } from "@/features/auth/permissions";
import { roleLabelKey } from "@/features/auth/roles";
import type { Actor } from "@/features/auth/rules";
import { useAuthStore, useSession } from "@/features/auth/session";
import { useI18n } from "@/i18n";
import { ALL_ROWS, LoadView, ScreenHeader, Toolbar, contains, useAction, useDraft, useLoad } from "./kit";
import { changedRoles, editableRoles, withBuiltInDefaults, type RoleMaps } from "./matrix";
import { DataTable, type Column } from "./tools/table";
import { ICON_SIZE } from "./tools/ui";

const FEATURE_PREFIX = "admin.perm.feature";
const ACTION_PREFIX = "admin.perm.action";
const rowKey = ({ feature, action }: Permission) => `${feature}:${action}`;

interface MatrixProps {
  stored: RoleMaps;
  actor: Actor;
  reload: () => void;
}

function Matrix({ stored, actor, reload }: MatrixProps) {
  const { t, tData } = useI18n();
  const store = useAuthStore();
  const toast = useToast();
  const { busy, run } = useAction(reload);
  // A reload hands over a new `stored`, which starts the draft again.
  const [draft, setDraft] = useDraft(stored, (maps) => maps);
  const [query, setQuery] = useState("");
  const editable = editableRoles(actor);
  const changed = changedRoles(stored, draft);
  const atDefaults = changedRoles(withBuiltInDefaults(draft, editable), draft).length === 0;
  const label = ({ feature, action }: Permission) => t("admin.roles.permission", { feature: tData(FEATURE_PREFIX, feature), action: tData(ACTION_PREFIX, action) });

  const save = () =>
    run(async () => {
      for (const role of changed) await store.setRoleDefaults({ role, permissions: draft[role] });
      toast.success({ title: "admin.roles.saved" });
    });

  const columns: Column<Permission>[] = [
    { key: "permission", header: t("admin.roles.permissionHeader"), cell: (row) => <Text $medium>{label(row)}</Text> },
    ...MATRIX_ROLES.map((role): Column<Permission> => ({
      key: role,
      header: t(roleLabelKey(role)),
      cell: (row) => (
        <Checkbox
          checked={draft[role][row.feature]?.includes(row.action) ?? false}
          disabled={busy || !editable.includes(role)}
          onChange={() => setDraft({ ...draft, [role]: toggleAction(draft[role], row) })}
        >
          <VisuallyHidden>{t("admin.roles.cell", { permission: label(row), role: t(roleLabelKey(role)) })}</VisuallyHidden>
        </Checkbox>
      ),
    })),
  ];

  return (
    <>
      <Toolbar search={{ value: query, onChange: setQuery, label: t("admin.roles.search") }} onRefresh={reload}>
        <Button type="button" $variant="primary" disabled={busy || changed.length === 0} onClick={() => void save()}>
          <Save size={ICON_SIZE} aria-hidden />
          {t(busy ? "admin.saving" : "action.save")}
        </Button>
        <Button type="button" disabled={busy || atDefaults} onClick={() => setDraft(withBuiltInDefaults(draft, editable))}>
          <RotateCcw size={ICON_SIZE} aria-hidden />
          {t("admin.roles.reset")}
        </Button>
      </Toolbar>
      {editable.includes(MATRIX_ROLES[0]) ? null : (
        <Notice $tone="info" role="note">
          <Text $size="sm">{t("admin.roles.topReadOnly")}</Text>
        </Notice>
      )}
      <Notice $tone={changed.length > 0 ? "warning" : "neutral"} role="status">
        <Text $size="sm">
          {changed.length > 0 ? t("admin.roles.unsaved", { roles: changed.map((role) => t(roleLabelKey(role))).join(", ") }) : t("admin.roles.noChanges")}
        </Text>
      </Notice>
      <DataTable
        caption={t("admin.nav.roles")}
        columns={columns}
        rows={MATRIX_ROWS.filter((row) => contains(query, [label(row), rowKey(row)]))}
        rowKey={rowKey}
        empty={t("admin.noMatch")}
        pageSize={ALL_ROWS}
      />
    </>
  );
}

/** Role defaults: one row per permission, one checkbox column per level. Edits are a draft until Save. */
export function RolesScreen() {
  const store = useAuthStore();
  const { user: actor } = useSession();
  const load = useLoad(useCallback(() => store.getRoleDefaults(), [store]));
  if (!actor) return null;
  return (
    <Stack $gap="lg">
      <ScreenHeader titleKey="admin.nav.roles" descKey="admin.roles.desc" />
      <LoadView load={load}>{(stored) => <Matrix stored={stored} actor={actor} reload={load.reload} />}</LoadView>
    </Stack>
  );
}
