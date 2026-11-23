"use client";

import { Eye, EyeOff, Settings } from "lucide-react";
import { useId, useState } from "react";
import { Badge, Checkbox, Ltr, Notice, Select, Stack, Text, VisuallyHidden, useToast } from "@/components/ui";
import { REPORTS } from "@/data/reports";
import { useI18n } from "@/i18n";
import { ScreenHeader, Toolbar, contains, useDraft } from "./kit";
import { TITLE_MAX, registryStore, saveField, settingsOf, useReportDefs, type Localized, type ReportFieldView, type ReportView } from "./registry";
import { BilingualField, useBuiltInText } from "./ReportDialog";
import { DataTable, type Column } from "./tools/table";
import { isIdentifier } from "./tools/model";
import { FormDialog, ICON_SIZE, IconButton, Option } from "./tools/ui";

/** Only this table paginates. */
const FIELDS_PAGE_SIZE = 10;
const NO_TEXT: Localized = { en: "", he: "" };

interface FieldDraft {
  label: Localized;
  hidden: boolean;
}

interface FieldDialogProps {
  report: ReportView;
  /** `null` keeps the dialog closed. */
  field: ReportFieldView | null;
  onClose: () => void;
}

function FieldDialog({ report, field, onClose }: FieldDialogProps) {
  const { t } = useI18n();
  const toast = useToast();
  const registry = registryStore.useValue();
  const builtInText = useBuiltInText();
  const stored = (key: string | undefined): FieldDraft => {
    const fields = settingsOf(registry, report.id)?.fields ?? {};
    return key !== undefined && Object.hasOwn(fields, key) ? fields[key] : { label: NO_TEXT, hidden: false };
  };
  const [draft, setDraft] = useDraft(field, (next) => stored(next?.key));
  const dirty = JSON.stringify(draft) !== JSON.stringify(stored(field?.key));
  const result = saveField(registry, { id: report.id, key: field?.key ?? "", ...draft });
  const labelKey = REPORTS.find((item) => item.id === report.source)?.fields.find((item) => item.key === field?.key)?.labelKey;

  const submit = () => {
    if (!result.ok || !field) return;
    registryStore.write(result.value);
    toast.success({ title: "admin.fields.saved", titleVars: { name: field.key } });
    onClose();
  };

  return (
    <FormDialog
      open={field !== null}
      title={t("admin.fields.editTitle", { name: field?.label ?? "" })}
      dirty={dirty}
      onClose={onClose}
      onSubmit={submit}
      submitLabel={t("action.save")}
      submitDisabled={!dirty || !result.ok}
    >
      <Text $muted $size="sm">
        {t("admin.fields.key")}: <Ltr>{field?.key}</Ltr>
      </Text>
      <BilingualField label={t("admin.fields.label")} value={draft.label} onChange={(label) => setDraft({ ...draft, label })} placeholder={builtInText(labelKey)} maxLength={TITLE_MAX} />
      <Text $muted $size="xs">
        {t("admin.reports.emptyUsesBuiltIn")}
      </Text>
      <Checkbox checked={!draft.hidden} onChange={(visible) => setDraft({ ...draft, hidden: !visible })}>
        {t("admin.fields.showInReport")}
      </Checkbox>
      {dirty && !result.ok ? (
        <Notice $tone="warning" role="status">
          <Text $size="sm">{t(`admin.reports.error.${result.error}`)}</Text>
        </Notice>
      ) : null}
    </FormDialog>
  );
}

/** Field definitions of one report: the label in both languages and whether the field is shown. */
export function FieldsScreen({ initialReport }: { initialReport: string }) {
  const { t } = useI18n();
  const selectId = useId();
  const reports = useReportDefs();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(initialReport);
  const [editing, setEditing] = useState<ReportFieldView | null>(null);
  // The id comes from the address bar: it must look like an identifier and name a known report, else the first report shows.
  const report = (isIdentifier(selected) ? reports.find((item) => item.id === selected) : undefined) ?? reports[0];

  const columns: Column<ReportFieldView>[] = [
    { key: "key", header: t("admin.fields.key"), cell: (field) => <Ltr>{field.key}</Ltr> },
    { key: "label", header: t("admin.fields.label"), cell: (field) => <Text $medium>{field.label}</Text> },
    {
      key: "type",
      header: t("admin.fields.type"),
      cell: (field) => (
        <Badge>
          <Ltr>{field.type}</Ltr>
        </Badge>
      ),
    },
    {
      key: "visible",
      header: t("admin.fields.visibility"),
      cell: (field) => (
        <Badge $tone={field.hidden ? "neutral" : "success"}>
          {field.hidden ? <EyeOff size={ICON_SIZE} aria-hidden /> : <Eye size={ICON_SIZE} aria-hidden />}
          {t(field.hidden ? "admin.fields.hidden" : "admin.fields.visible")}
        </Badge>
      ),
    },
    { key: "actions", header: t("admin.actions"), cell: (field) => <IconButton label={t("admin.fields.edit", { name: field.label })} icon={Settings} onClick={() => setEditing(field)} /> },
  ];

  return (
    <Stack $gap="lg">
      <ScreenHeader titleKey="admin.nav.fields" descKey="admin.fields.desc" />
      <Notice $tone="info" role="note">
        <Text $size="sm">{t("admin.reports.notWired")}</Text>
      </Notice>
      <Toolbar search={{ value: query, onChange: setQuery, label: t("admin.fields.search") }}>
        <VisuallyHidden as="label" htmlFor={selectId}>
          {t("admin.fields.report")}
        </VisuallyHidden>
        <Select id={selectId} value={report.id} onChange={(event) => setSelected(event.target.value)}>
          {reports.map((item) => (
            <Option key={item.id} value={item.id}>
              {t("admin.reports.sourceOption", { title: item.title, id: item.id })}
            </Option>
          ))}
        </Select>
      </Toolbar>
      <DataTable
        caption={t("admin.fields.caption", { name: report.title })}
        columns={columns}
        rows={report.fields.filter((field) => contains(query, [field.key, field.label, field.type]))}
        rowKey={(field) => field.key}
        empty={t("admin.noMatch")}
        pageSize={FIELDS_PAGE_SIZE}
        resetKey={`${report.id}:${query}`}
      />
      <FieldDialog report={report} field={editing} onClose={() => setEditing(null)} />
    </Stack>
  );
}
