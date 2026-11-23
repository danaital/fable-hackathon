"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import styled, { css } from "styled-components";
import { Button, Dialog, Heading, Paragraph, Stack, Text, VisuallyHidden } from "@/components/ui";
import { CurrencyFields } from "@/features/currency/CurrencyFields";
import { customDateProblem } from "@/features/currency/timing";
import { useI18n } from "@/i18n";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "@/lib/prefs";
import { CustomizationFields } from "./CustomizationFields";
import { ChoiceField } from "./fields";
import { FormattingFields } from "./FormattingFields";
import { DEFAULT_USER_SETTINGS, userSettingsSchema, type UserSettings } from "./schema";
import { userSettingsStore } from "./store";
import { Tabs, type TabDef } from "./Tabs";

const TAB_IDS = ["formatting", "currency", "customization"] as const;
type TabId = (typeof TAB_IDS)[number];
const HOME = "/";

const Footer = styled.div`
  ${({ theme: { color, space } }) => css`
    position: sticky;
    inset-block-end: 0;
    display: flex;
    flex-wrap: wrap;
    gap: ${space.sm};
    padding-block: ${space.md};
    background: ${color.bg};
    border-block-start: 1px solid ${color.border};
  `}
`;

type Dialogs = "unsaved" | "resetAll" | null;

/** User settings: pending edits per tab, saved together; language also updates the locale cookie. */
export function SettingsPage() {
  const { t, locale, setLocale } = useI18n();
  const router = useRouter();
  const saved = userSettingsStore.useValue();
  const [draft, setDraft] = useState<UserSettings | null>(null);
  const [language, setLanguage] = useState<Locale | null>(null);
  const [tab, setTab] = useState<TabId>("formatting");
  const [dialog, setDialog] = useState<Dialogs>(null);
  const [announcement, setAnnouncement] = useState("");

  const current = draft ?? saved;
  const currentLanguage = language ?? locale;
  const dirty = (draft !== null && JSON.stringify(draft) !== JSON.stringify(saved)) || currentLanguage !== locale;
  const valid = userSettingsSchema.safeParse(current).success && !customDateProblem({ currency: current.currency, now: new Date() });

  // Closing or reloading the tab with pending changes triggers the browser's own "leave site?" prompt.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const patch = <K extends TabId>(section: K, change: Partial<UserSettings[K]>) => {
    setAnnouncement("");
    setDraft((previous) => {
      const base = previous ?? saved;
      return { ...base, [section]: { ...base[section], ...change } };
    });
  };

  const save = () => {
    if (!dirty || !valid) return;
    userSettingsStore.write(current);
    if (currentLanguage !== locale) setLocale(currentLanguage);
    setDraft(null);
    setLanguage(null);
    setAnnouncement(t("settings.saved"));
  };
  const discard = () => {
    setDraft(null);
    setLanguage(null);
  };
  const leave = (action: () => void) => {
    action();
    setDialog(null);
    router.push(HOME);
  };
  const resetTab = () => {
    patch(tab, DEFAULT_USER_SETTINGS[tab]);
    if (tab === "formatting") setLanguage(DEFAULT_LOCALE);
  };
  const defaults = { ...DEFAULT_USER_SETTINGS, themeMode: saved.themeMode };
  const resetAll = () => {
    setDraft(defaults);
    setLanguage(DEFAULT_LOCALE);
    setDialog(null);
  };
  const resetAndLeave = () =>
    leave(() => {
      userSettingsStore.write(defaults);
      if (locale !== DEFAULT_LOCALE) setLocale(DEFAULT_LOCALE);
    });

  const tabs: TabDef<TabId>[] = TAB_IDS.map((id) => ({ id, label: t(`settings.tab.${id}`) }));
  const panels: Record<TabId, () => ReactNode> = {
    formatting: () => (
      <Stack $gap="lg">
        <ChoiceField
          label={t("settings.language")}
          value={currentLanguage}
          options={LOCALES}
          optionLabel={(option) => t(`settings.language.${option}`)}
          onChange={(next) => setLanguage(next ?? DEFAULT_LOCALE)}
        />
        <FormattingFields value={current.formatting} effective={current.formatting} onChange={(change) => patch("formatting", change)} />
      </Stack>
    ),
    currency: () => (
      <CurrencyFields value={current.currency} effective={current.currency} onChange={(change) => patch("currency", change)} />
    ),
    customization: () => <CustomizationFields value={current.customization} onChange={(change) => patch("customization", change)} />,
  };

  return (
    <Stack $gap="lg">
      <Heading>{t("settings.title")}</Heading>
      <Tabs label={t("settings.tabs")} tabs={tabs} active={tab} onChange={setTab}>
        {panels[tab]()}
      </Tabs>
      <Footer>
        <Button $variant="primary" disabled={!dirty || !valid} onClick={save}>
          {t("action.save")}
        </Button>
        <Button disabled={!dirty} onClick={() => setDialog("unsaved")}>
          {t("action.cancel")}
        </Button>
        <Button $variant="ghost" onClick={resetTab}>
          {t("settings.resetTab")}
        </Button>
        <Button $variant="ghost" onClick={() => setDialog("resetAll")}>
          {t("settings.resetAll")}
        </Button>
        {dirty && !valid ? (
          <Text role="alert" $size="sm">
            {t("settings.invalid")}
          </Text>
        ) : null}
        <VisuallyHidden role="status">{announcement}</VisuallyHidden>
      </Footer>

      <Dialog
        open={dialog === "unsaved"}
        onClose={() => setDialog(null)}
        title={t("settings.unsaved.title")}
        footer={
          <>
            <Button $variant="primary" disabled={!valid} onClick={() => leave(save)}>
              {t("action.save")}
            </Button>
            <Button onClick={() => leave(discard)}>{t("settings.discard")}</Button>
            <Button $variant="ghost" onClick={() => setDialog(null)}>
              {t("settings.stay")}
            </Button>
          </>
        }
      >
        <Paragraph>{t("settings.unsaved.body")}</Paragraph>
      </Dialog>

      <Dialog
        open={dialog === "resetAll"}
        onClose={() => setDialog(null)}
        title={t("settings.resetAll.title")}
        footer={
          <>
            <Button $variant="primary" onClick={resetAll}>
              {t("action.reset")}
            </Button>
            <Button onClick={resetAndLeave}>{t("settings.resetAll.close")}</Button>
            <Button $variant="ghost" onClick={() => setDialog(null)}>
              {t("action.cancel")}
            </Button>
          </>
        }
      >
        <Paragraph>{t("settings.resetAll.body")}</Paragraph>
      </Dialog>
    </Stack>
  );
}
