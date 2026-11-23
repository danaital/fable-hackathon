"use client";

import { Badge, Ltr, Notice, Stack, Text } from "@/components/ui";
import { useI18n, type I18nKey } from "@/i18n";
import type { ToneName } from "@/styles/theme";
import { ITEM_STATUSES, type IssueCode, type ItemStatus, type PlanIssue } from "./configImport";
import type { ImportPreviewData, PreviewItem } from "./importRun";
import { DataTable, type Column } from "./table";
import { List, ListItem } from "./ui";

// Status is never colour alone: every badge carries its text.
const STATUS_TONE: Record<ItemStatus, ToneName> = { create: "success", update: "info", unchanged: "neutral", invalid: "danger" };
// Problems first, then what the import would change.
const STATUS_ORDER: Record<ItemStatus, number> = { invalid: 0, create: 1, update: 2, unchanged: 3 };

const ISSUE_TEXT: Record<IssueCode, I18nKey> = {
  schema: "adminTools.issue.schema",
  identifier: "adminTools.identifier",
  duplicate: "adminTools.issue.duplicate",
  unknownField: "adminTools.issue.unknownField",
  unknownEntity: "adminTools.issue.unknownEntity",
  unknownColumn: "adminTools.issue.unknownColumn",
  sameEntity: "adminTools.issue.sameEntity",
  aliasTaken: "adminTools.issue.aliasTaken",
  tooLong: "adminTools.issue.tooLong",
  translationKey: "adminTools.issue.translationKey",
  noText: "adminTools.issue.noText",
};

/** Everything in an issue comes from the file, so it is only ever rendered as text. */
function Issues({ issues }: { issues: readonly PlanIssue[] }) {
  const { t } = useI18n();
  if (issues.length === 0) return <Text $muted>{t("adminTools.none")}</Text>;
  return (
    <List>
      {issues.map((issue, index) => (
        <ListItem key={index}>
          {issue.path ? <Ltr>{issue.path}: </Ltr> : null}
          {t(ISSUE_TEXT[issue.code], { detail: issue.detail })}
        </ListItem>
      ))}
    </List>
  );
}

/** What an import would do, item by item, before anything is stored. */
export function ImportPreview({ items, counts, problems }: Pick<ImportPreviewData, "items" | "counts" | "problems">) {
  const { t } = useI18n();
  const columns: Column<PreviewItem & { position: number }>[] = [
    { key: "status", header: t("adminTools.preview.status"), cell: (item) => <Badge $tone={STATUS_TONE[item.status]}>{t(`adminTools.status.${item.status}`)}</Badge> },
    { key: "section", header: t("adminTools.preview.section"), cell: (item) => t(`adminTools.section.${item.section}`) },
    { key: "name", header: t("adminTools.preview.name"), cell: (item) => <Ltr>{item.name}</Ltr> },
    { key: "issues", header: t("adminTools.preview.issues"), cell: (item) => <Issues issues={item.issues} /> },
  ];
  const rows = items.map((item, position) => ({ ...item, position })).sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.position - b.position);

  return (
    <Stack $gap="md">
      <Stack $row $wrap $gap="sm" role="status">
        {ITEM_STATUSES.map((status) => (
          <Badge key={status} $tone={STATUS_TONE[status]}>
            {t(`adminTools.count.${status}`, { count: counts[status] })}
          </Badge>
        ))}
      </Stack>
      {problems.map((problem) => (
        <Notice key={problem} $tone="danger" role="alert">
          {t(`adminTools.problem.${problem}`)}
        </Notice>
      ))}
      <DataTable caption={t("adminTools.preview.caption")} columns={columns} rows={rows} rowKey={(item) => item.position} empty={t("adminTools.preview.empty")} />
    </Stack>
  );
}
