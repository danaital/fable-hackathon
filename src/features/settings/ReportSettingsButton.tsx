"use client";

import { SlidersHorizontal } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button, Dialog, Paragraph } from "@/components/ui";
import type { ReportDef } from "@/data/types";
import { CurrencyFields } from "@/features/currency/CurrencyFields";
import { customDateProblem } from "@/features/currency/timing";
import { useReport } from "@/features/report/ReportContext";
import { useI18n } from "@/i18n";
import { CustomizationFields } from "./CustomizationFields";
import { FormattingFields } from "./FormattingFields";
import { reportSettingsSchema, resolveEffective, type ReportSettings } from "./schema";
import { saveReportSettings, useReportSettings, userSettingsStore } from "./store";
import { Tabs, type TabDef } from "./Tabs";

const ICON_SIZE = 16;
const TAB_IDS = ["formatting", "currency", "customization"] as const;
type TabId = (typeof TAB_IDS)[number];

/** Opens this report's own settings: every choice can be left to inherit the user's settings. */
export function ReportSettingsButton() {
  const { t } = useI18n();
  const { report, name } = useReport();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <SlidersHorizontal size={ICON_SIZE} aria-hidden />
        {t("settings.report.open")}
      </Button>
      {open ? <ReportSettingsDialog report={report} name={name} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function ReportSettingsDialog({ report, name, onClose }: { report: ReportDef; name: string; onClose: () => void }) {
  const { t } = useI18n();
  const saved = useReportSettings(report.id);
  const user = userSettingsStore.useValue();
  const [pending, setPending] = useState<ReportSettings>(saved);
  const [tab, setTab] = useState<TabId>("formatting");
  const effective = resolveEffective(user, pending);
  const valid = reportSettingsSchema.safeParse(pending).success && !customDateProblem({ currency: effective.currency, now: new Date() });

  const patch = <K extends TabId>(section: K, change: NonNullable<ReportSettings[K]>) =>
    setPending((previous) => ({ ...previous, [section]: { ...previous[section], ...change } }));
  const done = () => {
    saveReportSettings(report.id, pending);
    onClose();
  };

  const tabs: TabDef<TabId>[] = TAB_IDS.map((id) => ({ id, label: t(`settings.tab.${id}`) }));
  const panels: Record<TabId, () => ReactNode> = {
    formatting: () => (
      <FormattingFields
        value={pending.formatting ?? {}}
        effective={effective.formatting}
        inherited={user.formatting}
        onChange={(change) => patch("formatting", change)}
      />
    ),
    currency: () => (
      <CurrencyFields
        value={pending.currency ?? {}}
        effective={effective.currency}
        inherited={user.currency}
        fields={report.fields}
        onChange={(change) => patch("currency", change)}
      />
    ),
    customization: () => (
      <CustomizationFields value={pending.customization ?? {}} inherited={user.customization} onChange={(change) => patch("customization", change)} />
    ),
  };

  return (
    <Dialog
      open
      $wide
      onClose={onClose}
      title={t("settings.report.title", { name })}
      footer={
        <>
          <Button $variant="primary" disabled={!valid} onClick={done}>
            {t("action.done")}
          </Button>
          <Button onClick={onClose}>{t("action.cancel")}</Button>
          <Button $variant="ghost" onClick={() => setPending({})}>
            {t("settings.report.reset")}
          </Button>
        </>
      }
    >
      <Paragraph $muted $size="sm">
        {t("settings.report.desc")}
      </Paragraph>
      <Tabs label={t("settings.tabs")} tabs={tabs} active={tab} onChange={setTab}>
        {panels[tab]()}
      </Tabs>
    </Dialog>
  );
}
