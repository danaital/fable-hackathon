"use client";

import { Lightbulb } from "lucide-react";
import { useId, type ComponentType } from "react";
import { Chip, Ltr, Notice, Paragraph, Stack, Text } from "@/components/ui";
import { useReport } from "@/features/report/ReportContext";
import { useI18n } from "@/i18n";
import type { ChartData } from "../chartData";
import { chartStats } from "../chartView";
import type { ChartConfig, ChartType } from "../config";
import type { SummaryTools } from "../useSummary";
import { BarsChart, LinesChart, PointsChart, type ChartRenderProps } from "./CartesianCharts";
import { ChartLegend } from "./ChartLegend";
import { ChartTable } from "./ChartTable";
import { describeChart } from "./describe";
import type { ChartModel } from "./model";
import { PieSlices } from "./PieSlices";
import { Bullet, BulletList, ChartBox, ChartLayout, FigCaption, Figure, InsightBox } from "./primitives";

/** Every chart type has a renderer; "free" is a definition that fits no type yet and draws as bars. */
const RENDERERS: Record<ChartType, ComponentType<ChartRenderProps>> = {
  bar: BarsChart,
  horizontalBar: BarsChart,
  multiBar: BarsChart,
  free: BarsChart,
  line: LinesChart,
  area: LinesChart,
  scatter: PointsChart,
  pie: PieSlices,
  doughnut: PieSlices,
};
/** Types whose series are told apart by marker shape rather than by texture. */
const MARKER_TYPES: ReadonlySet<ChartType> = new Set(["line", "area", "scatter"]);
const CARD_HEIGHT = 280;
const ENLARGED_HEIGHT = 440;
const ICON_SIZE = 16;
/** Formatters take percentages as whole numbers; shares are 0 to 1. */
const PERCENT = 100;

interface ChartViewProps {
  chart: ChartConfig;
  title: string;
  data: ChartData;
  model: ChartModel;
  /** True for the copy inside the enlarge dialog. */
  enlarged: boolean;
  asTable: boolean;
  onToggle: (key: string) => void;
  tools: SummaryTools;
}

/** A chart with everything that makes it readable without seeing it: description, legend, table alternative, insights. */
export function ChartView({ chart, title, data, model, enlarged, asTable, onToggle, tools }: ChartViewProps) {
  const { t, dir } = useI18n();
  const { format } = useReport();
  const descriptionId = useId();
  const formatValue = (value: number) => tools.formatMeasure({ value, unit: data.unit });
  const formatShare = (share: number) => format.percent(share * PERCENT);
  const hidden = model.legend.filter((item) => item.hidden).map((item) => item.key);
  const description = describeChart({
    stats: chartStats({ data, type: chart.type, hidden }),
    type: chart.type,
    title,
    t,
    formatValue,
    formatShare,
    withShares: data.aggregation !== "average",
  });
  const Renderer = RENDERERS[chart.type];
  const allHidden = model.series.length === 0 || model.categories.length === 0;
  // An enlarged pie has room for its legend beside it; in the card the legend sits below.
  const side = model.pie && enlarged;
  const { insights } = chart;

  return (
    <Figure>
      <FigCaption id={descriptionId}>{description}</FigCaption>
      <ChartLayout $side={side}>
        {allHidden ? <Notice role="status">{t("summary.chart.allHidden")}</Notice> : null}
        {!allHidden && asTable ? (
          <ChartTable title={title} categoryLabel={tools.fieldLabel(chart.groupBy ?? chart.dataField)} model={model} formatValue={formatValue} formatShare={formatShare} />
        ) : null}
        {!allHidden && !asTable ? (
          <ChartBox $height={enlarged ? ENLARGED_HEIGHT : CARD_HEIGHT} role="img" aria-label={title} aria-describedby={descriptionId}>
            <Renderer
              model={model}
              type={chart.type}
              rtl={dir === "rtl"}
              wholeNumbers={data.aggregation === "count"}
              formatValue={formatValue}
              formatShare={formatShare}
              formatNumber={format.number}
              xAxisLabel={chart.xAxisLabel ? tools.text(chart.xAxisLabel) : undefined}
              yAxisLabel={chart.yAxisLabel ? tools.text(chart.yAxisLabel) : undefined}
            />
          </ChartBox>
        ) : null}
        {chart.showLegend === false ? null : (
          <ChartLegend title={title} items={model.legend} column={side} marker={MARKER_TYPES.has(chart.type)} onToggle={onToggle} />
        )}
      </ChartLayout>
      {data.foldedCount > 0 ? (
        <Stack $row>
          <Chip>
            <Ltr>{t("summary.chart.otherFolded", { count: data.foldedCount })}</Ltr>
          </Chip>
        </Stack>
      ) : null}
      {insights ? (
        <InsightBox>
          <Stack $row $gap="sm">
            <Lightbulb size={ICON_SIZE} aria-hidden />
            <Text $medium $size="sm">
              {insights.title ? tools.text(insights.title) : t("summary.chart.insights")}
            </Text>
          </Stack>
          {insights.lines.length === 1 ? (
            <Paragraph $size="sm">{tools.text(insights.lines[0])}</Paragraph>
          ) : (
            <BulletList>
              {insights.lines.map((line) => (
                <Bullet key={line.en}>{tools.text(line)}</Bullet>
              ))}
            </BulletList>
          )}
        </InsightBox>
      ) : null}
    </Figure>
  );
}
