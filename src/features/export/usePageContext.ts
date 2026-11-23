"use client";

import { useMemo } from "react";
import { useReport } from "@/features/report/ReportContext";
import { useI18n } from "@/i18n";
import { readCharts } from "./chartSource";
import type { PageContext } from "./plan";
import { useSavedViews } from "./savedViews";
import { exportTemplates } from "./templates";

/** Everything an export reads from the report page, gathered once for the wizard and the one-click exports. */
export function usePageContext(): PageContext {
  const { report, rows, filteredRows, view } = useReport();
  const { locale } = useI18n();
  const { savedViews, currentViewId } = useSavedViews(report);
  const allTemplates = exportTemplates.useList();

  return useMemo(
    () => ({
      report,
      rows,
      filteredRows,
      view,
      savedViews,
      currentViewId,
      // A template belongs to one report; another report's templates are never offered here.
      templates: allTemplates.filter((template) => template.reportId === report.id),
      charts: readCharts(),
      uiLocale: locale,
    }),
    [report, rows, filteredRows, view, savedViews, currentViewId, allTemplates, locale],
  );
}
