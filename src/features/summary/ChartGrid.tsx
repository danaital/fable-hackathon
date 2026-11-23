"use client";

import { useId, useMemo } from "react";
import { Grid, Heading, Notice, Stack, VisuallyHidden } from "@/components/ui";
import { useReport } from "@/features/report/ReportContext";
import { useI18n } from "@/i18n";
import { ChartBoundary, ChartCard } from "./charts/ChartCard";
import { defaultCharts } from "./charts/defaults";
import { ChartSection } from "./charts/primitives";
import { useSummaryConfig } from "./summaryConfig";
import { useExplore, useSummaryRows, useSummaryTools, visibleItems } from "./useSummary";
import { VisibilityDialog } from "./VisibilityDialog";

/** Narrowest a chart card gets before the grid drops a column; a phone always gets one column. */
const CARD_MIN_WIDTH = "360px";

/** The report's charts, calculated in the browser from the same rows as the table. The view decides which are shown. */
export function ChartGrid() {
  const { t } = useI18n();
  const { report, view, setView } = useReport();
  const config = useSummaryConfig(report.id);
  const tools = useSummaryTools();
  const { rows, busy, now } = useSummaryRows();
  const { explore, announcement } = useExplore();
  const headingId = useId();
  // A report without chart configuration still gets charts, built from its fields.
  const charts = useMemo(() => (config.charts.length > 0 ? config.charts : defaultCharts(report)), [config.charts, report]);
  const visible = visibleItems(charts, view.charts);

  return (
    <ChartSection aria-labelledby={headingId}>
      <Stack $row $wrap $justify="space-between" $gap="md">
        <Heading as="h2" $size="lg" id={headingId}>
          {t("summary.charts.title")}
        </Heading>
        <VisibilityDialog
          label={t("summary.charts.choose")}
          items={charts.map((chart) => ({ id: chart.id, title: tools.text(chart.title) }))}
          shown={view.charts}
          onChange={(shown) => setView({ charts: shown })}
        />
      </Stack>
      {visible.length === 0 ? (
        <Notice role="status">{t("summary.charts.noneVisible")}</Notice>
      ) : (
        <Grid $min={CARD_MIN_WIDTH}>
          {visible.map((chart) => (
            <ChartBoundary key={chart.id} chartId={chart.id} title={tools.text(chart.title)}>
              <ChartCard chart={chart} rows={rows} busy={busy} now={now} tools={tools} onExplore={explore} />
            </ChartBoundary>
          ))}
        </Grid>
      )}
      <VisuallyHidden role="status">{announcement}</VisuallyHidden>
    </ChartSection>
  );
}
