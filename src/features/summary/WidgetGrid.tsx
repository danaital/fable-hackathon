"use client";

import { useId, useMemo } from "react";
import { Heading, Notice, Stack, VisuallyHidden } from "@/components/ui";
import { useReport } from "@/features/report/ReportContext";
import { useI18n } from "@/i18n";
import { evaluateCondition } from "./conditions";
import { Section, TableAnchor, WidgetGridBox } from "./primitives";
import { useSummaryConfig } from "./summaryConfig";
import { TABLE_ANCHOR_ID, useExplore, useSummaryRows, useSummaryTools, visibleItems } from "./useSummary";
import { VisibilityDialog } from "./VisibilityDialog";
import { WidgetCard, widgetTitle } from "./WidgetCard";
import { calculateWidget } from "./widgetCalc";

/** The report's key figures, calculated in the browser from the same filtered rows as the table. */
export function WidgetGrid() {
  const { t } = useI18n();
  const { report, view, setView } = useReport();
  const { widgets } = useSummaryConfig(report.id);
  const tools = useSummaryTools();
  const { rows, busy, now } = useSummaryRows();
  const { explore, announcement } = useExplore();
  const headingId = useId();

  const visible = useMemo(() => visibleItems(widgets, view.widgets), [widgets, view.widgets]);
  // Keyed by widget id, in one pass. Each calculation is isolated: a failing widget returns its own error result.
  const results = useMemo(
    () =>
      rows &&
      new Map(
        visible.map((widget) => [
          widget.id,
          {
            result: calculateWidget({ widget, rows: widget.ignoreActiveFilters ? rows.all : rows.filtered, fields: report.fields, now }),
            outcome: evaluateCondition(widget.displayCondition, rows.filtered),
          },
        ]),
      ),
    [rows, visible, report.fields, now],
  );

  return (
    <Section aria-labelledby={headingId}>
      <Stack $row $wrap $justify="space-between" $gap="sm">
        <Heading as="h2" $size="lg" id={headingId}>
          {t("summary.widgets.title")}
        </Heading>
        <VisibilityDialog
          label={t("summary.widgets.choose")}
          items={widgets.map((widget) => ({ id: widget.id, title: widgetTitle(tools.text(widget.title)) }))}
          shown={view.widgets}
          onChange={(shown) => setView({ widgets: shown })}
        />
      </Stack>
      {visible.length === 0 ? (
        <Notice role="status">{t("summary.widgets.noneVisible")}</Notice>
      ) : (
        <WidgetGridBox aria-busy={busy}>
          {visible.map((widget) => (
            <WidgetCard
              key={widget.id}
              widget={widget}
              result={results?.get(widget.id)?.result ?? null}
              outcome={results?.get(widget.id)?.outcome ?? "met"}
              busy={busy && results !== null}
              tools={tools}
              onExplore={explore}
            />
          ))}
        </WidgetGridBox>
      )}
      <VisuallyHidden role="status">{announcement}</VisuallyHidden>
      <TableAnchor id={TABLE_ANCHOR_ID} tabIndex={-1} />
    </Section>
  );
}
