"use client";

import { ChartArea, ChartBar, ChartColumn, ChartColumnStacked, ChartLine, ChartPie, ChartScatter, Donut, Table2, type LucideIcon } from "lucide-react";
import { Component, useMemo, useState, type ReactNode } from "react";
import { useTheme } from "styled-components";
import { Badge, Button, Card, Heading, Notice, Stack, Text } from "@/components/ui";
import { useReport } from "@/features/report/ReportContext";
import { useI18n, type I18nKey } from "@/i18n";
import { logger } from "@/lib/logger";
import { CardError, CardFrame } from "../CardFrame";
import { legendEntries, pruneHidden, toggleHidden } from "../chartView";
import type { ConditionOutcome } from "../conditions";
import type { ChartConfig, ChartType } from "../config";
import type { ExploreInput, SummaryRows, SummaryTools } from "../useSummary";
import type { NoticeCode } from "../values";
import { ChartView } from "./ChartView";
import { chartSubtitle } from "./describe";
import { buildModel, computeChart, drawnType, isEmpty } from "./model";
import { ChartSkeleton } from "./primitives";
import type { TimeStep } from "./timeStep";

const ICON_SIZE = 18;
const TYPE_ICONS: Record<ChartType, LucideIcon> = {
  bar: ChartColumn,
  horizontalBar: ChartBar,
  multiBar: ChartColumnStacked,
  free: ChartColumn,
  line: ChartLine,
  area: ChartArea,
  scatter: ChartScatter,
  pie: ChartPie,
  doughnut: Donut,
};
const NOTICE_KEYS: Record<NoticeCode, I18nKey> = { mixedCurrency: "summary.notice.mixedCurrency" };
/** Why a trend is grouped by a finer step than configured. A trend is never regrouped into years. */
const STEP_NOTES: Record<Exclude<TimeStep, "year">, I18nKey> = { month: "charts.note.step.month", week: "charts.note.step.week", day: "charts.note.step.day" };

interface BoundaryProps {
  chartId: string;
  title: string;
  children: ReactNode;
}

/** Keeps a failing chart (a bad calculation or a drawing error) inside its own card: the rest of the grid stays up. */
export class ChartBoundary extends Component<BoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(error: Error): void {
    logger.error("chart card failed", { chart: this.props.chartId, error: error.message });
  }

  render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <Card>
        <Stack $gap="sm">
          <Heading as="h3" $size="md">
            {this.props.title}
          </Heading>
          <CardError />
        </Stack>
      </Card>
    );
  }
}

interface ChartCardProps {
  chart: ChartConfig;
  /** Null until the first calculation pass. */
  rows: SummaryRows | null;
  busy: boolean;
  now: Date;
  tools: SummaryTools;
  onExplore: (input: ExploreInput) => void;
}

export function ChartCard({ chart, rows, busy, now, tools, onExplore }: ChartCardProps) {
  const { t } = useI18n();
  const { report } = useReport();
  const { mode, color } = useTheme();
  // Card-local: not saved in the view, kept across data refreshes.
  const [hidden, setHidden] = useState<readonly string[]>([]);
  const [asTable, setAsTable] = useState(false);
  const title = tools.text(chart.title);
  const { labelFor } = tools;
  const input = rows === null ? null : chart.ignoreActiveFilters ? rows.all : rows.filtered;

  const result = useMemo(
    () => (input === null ? null : computeChart({ chart, rows: input, fields: report.fields, now, labelFor, title })),
    [input, chart, report.fields, now, labelFor, title],
  );
  const data = result?.kind === "data" && !isEmpty(result.data) ? result.data : null;
  const step = result?.kind === "data" ? result.step : null;
  const type = data ? drawnType(chart.type, data) : chart.type;
  // A hidden item that left the data is forgotten, so it is visible when it comes back.
  const shownHidden = data ? pruneHidden(hidden, legendEntries(data, chart.type).map((entry) => entry.key)) : hidden;
  if (shownHidden !== hidden) setHidden(shownHidden);
  const model = useMemo(
    () => (data ? buildModel({ data, type: chart.type, hidden: shownHidden, mode, otherColor: color.textMuted }) : null),
    [data, chart.type, shownHidden, mode, color.textMuted],
  );

  const withheld: Record<Exclude<ConditionOutcome, "met">, string> = {
    notScoped: t("summary.condition.notScoped", {
      fields: (chart.displayCondition?.requireSingleValueOn ?? []).map(tools.fieldLabel).join(t("summary.listSeparator")),
    }),
    notMet: t("summary.condition.notMet"),
  };
  const tableLabel = t(asTable ? "summary.chart.viewChart" : "summary.chart.viewTable", { title });
  const { drill } = chart;

  return (
    <CardFrame
      id={chart.id}
      title={title}
      icon={TYPE_ICONS[chart.type]}
      busy={busy}
      canEnlarge={model !== null}
      onExplore={drill ? () => onExplore({ id: chart.id, title, drill }) : undefined}
      actions={
        <Button $variant="ghost" $icon $active={asTable} aria-pressed={asTable} aria-label={tableLabel} title={tableLabel} disabled={model === null} onClick={() => setAsTable(!asTable)}>
          <Table2 size={ICON_SIZE} aria-hidden />
        </Button>
      }
    >
      {(enlarged) => (
        <>
          <Stack $row $wrap $gap="sm">
            <Text $muted $size="sm">
              {chartSubtitle({ chart, fieldLabel: tools.fieldLabel, t })}
            </Text>
            {chart.ignoreActiveFilters ? <Badge $tone="info">{t("charts.ignoresFilters")}</Badge> : null}
            {data && step && step !== "year" ? <Badge $tone="info">{t(STEP_NOTES[step])}</Badge> : null}
            {type === chart.type ? null : <Badge $tone="info">{t("charts.note.bars")}</Badge>}
          </Stack>
          {result === null ? <ChartSkeleton aria-hidden /> : null}
          {result?.kind === "withheld" ? (
            <Notice $tone="info" role="status">
              {withheld[result.outcome]}
            </Notice>
          ) : null}
          {result?.kind === "notice" ? (
            <Notice $tone="warning" role="status">
              {t(NOTICE_KEYS[result.code], { detail: result.detail })}
            </Notice>
          ) : null}
          {result?.kind === "data" && !data ? <Notice role="status">{t("summary.noData")}</Notice> : null}
          {data && model ? (
            <ChartView chart={chart} type={type} title={title} data={data} model={model} enlarged={enlarged} asTable={asTable} onToggle={(key) => setHidden(toggleHidden(shownHidden, key))} tools={tools} />
          ) : null}
        </>
      )}
    </CardFrame>
  );
}
