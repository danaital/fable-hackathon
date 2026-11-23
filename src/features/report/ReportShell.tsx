"use client";

import type { ReactNode } from "react";
import { Button, Heading, Link, Notice, Paragraph, ReportSkeleton, Stack, Text } from "@/components/ui";
import type { ReportDef } from "@/data/types";
import { CurrencyControl } from "@/features/currency/CurrencyControl";
import { CurrencyNotice } from "@/features/currency/CurrencyNotice";
import { CurrencyProvider } from "@/features/currency/CurrencyProvider";
import { ExportButton } from "@/features/export/ExportButton";
import { FilterToolbar } from "@/features/filters/FilterToolbar";
import { GroupingToolbar } from "@/features/grid/controls";
import { InsightsButton } from "@/features/insights/InsightsButton";
import { ReportSettingsButton } from "@/features/settings/ReportSettingsButton";
import { ViewBar } from "@/features/views/ViewBar";
import { useI18n } from "@/i18n";
import { ReportProvider } from "./ReportContext";
import { useRows } from "./useRows";

/**
 * Loads the rows, then mounts the shared report view and the slots every report page has in common.
 * Each feature owns one slot component and reads the view through useReport():
 * ViewBar, ExportButton, InsightsButton (header actions) and FilterToolbar here;
 * WidgetGrid, DataGrid and ChartGrid in app/report/[id]/summary/page.tsx (the report has one page).
 */
function ReportBody({ report, children }: { report: ReportDef; children: ReactNode }) {
  const { t } = useI18n();
  const { state, retry } = useRows(report.id);

  if (state.status === "loading") return <ReportSkeleton />;
  if (state.status === "error") {
    return (
      <Notice $tone="danger" role="alert">
        <Text>{t("grid.error")}</Text>
        <Button onClick={retry}>{t("grid.retry")}</Button>
      </Notice>
    );
  }

  return (
    // CurrencyProvider sits outside ReportProvider: the report view converts its rows with the rates it loads.
    <CurrencyProvider report={report} rows={state.rows}>
      <ReportProvider report={report} rows={state.rows}>
        <Stack $row $wrap $gap="sm">
          <ViewBar />
          <ExportButton />
          <InsightsButton />
          <ReportSettingsButton />
          <CurrencyControl />
        </Stack>
        <CurrencyNotice />
        <FilterToolbar />
        <GroupingToolbar />
        {children}
      </ReportProvider>
    </CurrencyProvider>
  );
}

export function ReportShell({ report, children }: { report: ReportDef | null; children: ReactNode }) {
  const { t } = useI18n();

  if (!report) {
    return (
      <Notice $tone="warning" role="alert">
        <Text>{t("report.notFound")}</Text>
        <Link href="/">{t("report.back")}</Link>
      </Notice>
    );
  }

  return (
    <Stack $gap="lg">
      <Stack $gap="xs">
        <Heading>{t(report.titleKey)}</Heading>
        <Paragraph $muted $size="sm">
          {t(report.descKey)}
        </Paragraph>
      </Stack>
      <ReportBody key={report.id} report={report}>
        {children}
      </ReportBody>
    </Stack>
  );
}
