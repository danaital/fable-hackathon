"use client";

import { Boxes, LifeBuoy, Package, ReceiptText, Truck, Users, type LucideIcon } from "lucide-react";
import { Checkbox, Field, Input, Ltr, Notice, Select, Stack, Text, Textarea, useToast } from "@/components/ui";
import { REPORTS } from "@/data/reports";
import { REPORT_ICONS, TAGS, type ReportIcon } from "@/data/types";
import { createTranslator, translationOverridesStore, useI18n, type I18nKey } from "@/i18n";
import { DIRECTION, LOCALES, type Locale } from "@/lib/prefs";
import { useDraft } from "./kit";
import { DESCRIPTION_MAX, REPORT_ID_MAX, TITLE_MAX, createReport, registryStore, saveReport, settingsOf, type Localized, type Registry, type ReportForm, type ReportView } from "./registry";
import { FormDialog, Option } from "./tools/ui";

// shortcut: the same icon map as the reports page (features/explore), which does not export it. Share one map when that page is wired to the registry.
export const REPORT_ICON: Record<ReportIcon, LucideIcon> = { orders: Package, customers: Users, invoices: ReceiptText, shipments: Truck, tickets: LifeBuoy, products: Boxes };

const LANGUAGE_LABEL: Record<Locale, I18nKey> = { en: "admin.lang.en", he: "admin.lang.he" };
const NO_TEXT: Localized = { en: "", he: "" };

/** Built-in text of a key in each language, for placeholders: what the app shows while the admin's text is empty. */
export function useBuiltInText(): (key: I18nKey | undefined) => Localized {
  const overrides = translationOverridesStore.useValue();
  return (key) => (key ? { en: createTranslator("en", overrides).t(key), he: createTranslator("he", overrides).t(key) } : NO_TEXT);
}

interface BilingualProps {
  label: string;
  value: Localized;
  onChange: (value: Localized) => void;
  placeholder: Localized;
  maxLength: number;
  multiline?: boolean;
}

/** One text in English and Hebrew, side by side in the form, each typed in its own direction. */
export function BilingualField({ label, value, onChange, placeholder, maxLength, multiline }: BilingualProps) {
  const { t } = useI18n();
  return LOCALES.map((locale) => (
    <Field key={locale} label={t(LANGUAGE_LABEL[locale], { label })}>
      {(id) => {
        const shared = { id, lang: locale, dir: DIRECTION[locale], maxLength, placeholder: placeholder[locale], value: value[locale] };
        const set = (text: string) => onChange({ ...value, [locale]: text });
        return multiline ? <Textarea {...shared} onChange={(event) => set(event.target.value)} /> : <Input {...shared} onChange={(event) => set(event.target.value)} />;
      }}
    </Field>
  ));
}

interface Draft extends ReportForm {
  id: string;
  source: string;
}

const NEW_REPORT: Draft = { id: "", source: REPORTS[0].id, title: NO_TEXT, description: NO_TEXT, icon: REPORTS[0].icon, tags: [] };

function draftOf(registry: Registry, report: ReportView | null): Draft {
  const settings = report ? settingsOf(registry, report.id) : null;
  if (!report || !settings) return NEW_REPORT;
  return { id: report.id, source: report.source, title: settings.title, description: settings.description, icon: settings.icon, tags: TAGS.filter((tag) => settings.tags.includes(tag)) };
}

export interface ReportDialogRequest {
  /** `null` creates a custom report. */
  report: ReportView | null;
}

/** Create a custom report, or edit the title, description, icon and tags of any report. */
export function ReportDialog({ request, onClose }: { request: ReportDialogRequest | null; onClose: () => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const registry = registryStore.useValue();
  const builtInText = useBuiltInText();
  const report = request?.report ?? null;
  const [draft, setDraft] = useDraft(request, (next) => draftOf(registry, next?.report ?? null));
  const { id, source, ...form } = draft;
  const dirty = JSON.stringify(draft) !== JSON.stringify(draftOf(registry, report));
  const result = report ? saveReport(registry, { id, form }) : createReport(registry, { id, source, form });
  // A built-in report falls back to its built-in texts; a custom report has none.
  const builtIn = report && !report.custom ? REPORTS.find((item) => item.id === report.id) : undefined;

  const submit = () => {
    if (!result.ok) return;
    registryStore.write(result.value);
    toast.success({ title: report ? "admin.reports.saved" : "admin.reports.created", titleVars: { name: id } });
    onClose();
  };

  return (
    <FormDialog
      open={request !== null}
      title={report ? t("admin.reports.editTitle", { name: report.title }) : t("admin.reports.create")}
      dirty={dirty}
      onClose={onClose}
      onSubmit={submit}
      submitLabel={t("action.save")}
      submitDisabled={!dirty || !result.ok}
    >
      {report ? (
        <Text $muted $size="sm">
          {t("admin.report.id")}: <Ltr>{id}</Ltr> · {t("admin.reports.source")}: <Ltr>{source}</Ltr>
        </Text>
      ) : (
        <>
          <Field label={t("admin.report.id")} hint={t("admin.reports.idHint", { max: REPORT_ID_MAX })}>
            {(inputId) => <Input id={inputId} required dir="ltr" autoCapitalize="none" spellCheck={false} maxLength={REPORT_ID_MAX} value={id} onChange={(event) => setDraft({ ...draft, id: event.target.value.trim() })} />}
          </Field>
          <Field label={t("admin.reports.source")} hint={t("admin.reports.sourceHint")}>
            {(inputId) => (
              <Select
                id={inputId}
                value={source}
                onChange={(event) => {
                  // Only a dataset from the list; the new report starts with that dataset's icon.
                  const picked = REPORTS.find((item) => item.id === event.target.value);
                  if (picked) setDraft({ ...draft, source: picked.id, icon: picked.icon });
                }}
              >
                {REPORTS.map((item) => (
                  <Option key={item.id} value={item.id}>
                    {t("admin.reports.sourceOption", { title: t(item.titleKey), id: item.id })}
                  </Option>
                ))}
              </Select>
            )}
          </Field>
        </>
      )}
      <BilingualField label={t("admin.report.title")} value={draft.title} onChange={(title) => setDraft({ ...draft, title })} placeholder={builtInText(builtIn?.titleKey)} maxLength={TITLE_MAX} />
      <BilingualField multiline label={t("admin.reports.description")} value={draft.description} onChange={(description) => setDraft({ ...draft, description })} placeholder={builtInText(builtIn?.descKey)} maxLength={DESCRIPTION_MAX} />
      {builtIn ? (
        <Text $muted $size="xs">
          {t("admin.reports.emptyUsesBuiltIn")}
        </Text>
      ) : null}
      <Field label={t("admin.reports.icon")}>
        {(inputId) => (
          <Select id={inputId} value={draft.icon} onChange={(event) => setDraft({ ...draft, icon: REPORT_ICONS.find((icon) => icon === event.target.value) ?? draft.icon })}>
            {REPORT_ICONS.map((icon) => (
              <Option key={icon} value={icon}>
                {t(`report.${icon}.title`)}
              </Option>
            ))}
          </Select>
        )}
      </Field>
      <Stack $gap="xs" role="group" aria-label={t("admin.reports.tags")}>
        <Text $medium>{t("admin.reports.tags")}</Text>
        <Stack $row $wrap $gap="md">
          {TAGS.map((tag) => (
            <Checkbox key={tag} checked={draft.tags.includes(tag)} onChange={(checked) => setDraft({ ...draft, tags: TAGS.filter((item) => (item === tag ? checked : draft.tags.includes(item))) })}>
              {t(`tag.${tag}`)}
            </Checkbox>
          ))}
        </Stack>
      </Stack>
      {dirty && !result.ok ? (
        <Notice $tone="warning" role="status">
          <Text $size="sm">{t(`admin.reports.error.${result.error}`)}</Text>
        </Notice>
      ) : null}
    </FormDialog>
  );
}
