"use client";

import { useTheme } from "styled-components";
import {
  Area,
  Bar,
  BarChart,
  BarStack,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
  type RenderableText,
  type TooltipContentProps,
} from "recharts";
import type { ChartType } from "../config";
import { needsTilt, shortLabel } from "./axis";
import { CategoryTooltip, PointTooltip, type ValueFormat } from "./ChartTooltip";
import { LABEL_KEY, type ChartModel } from "./model";

export interface ChartRenderProps extends ValueFormat {
  model: ChartModel;
  type: ChartType;
  /** Right-to-left page: the value axis moves to the right and categories run from the right. */
  rtl: boolean;
  /** Counts: no decimal ticks on the value axis. */
  wholeNumbers: boolean;
  /** Formats a raw number of the data (a scatter chart's x position). */
  formatNumber: (value: number) => string;
  /** Short form of a value, for axis ticks and labels drawn on the chart. */
  formatAxis: (value: number) => string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  /** Caption of the total in a doughnut's hole; absent where a total means nothing (averages). */
  totalLabel?: string;
}

const HORIZONTAL: ReadonlySet<ChartType> = new Set(["horizontalBar"]);
/** Several bars per category are stacked. */
const STACKED: ReadonlySet<ChartType> = new Set(["multiBar"]);
export const RESIZE_DELAY_MS = 50;
/** The top leaves room for a value label above the highest bar or point. */
const MARGIN = { top: 20, right: 12, bottom: 4, left: 12 };
/** Room past the end of the longest horizontal bar for its value label. */
const END_LABEL_ROOM = 48;
const VALUE_TICKS = 5;
const TICK_MARGIN = 8;
const MIN_TICK_GAP = 6;
/** Tick labels that collide are thinned out evenly instead of drawn over each other. */
const TICK_INTERVAL = "equidistantPreserveStart" as const;
const TILT = { angle: -35, textAnchor: "end" } as const;
/** A row label of a horizontal bar chart has the axis width to itself, so it may be longer than a column's. */
const MAX_ROW_LABEL_CHARS = 22;
const AXIS_TITLE_OFFSET = 10;
const BAR_RADIUS = 4;
const COLUMN_RADIUS: [number, number, number, number] = [BAR_RADIUS, BAR_RADIUS, 0, 0];
/** Rounds the value end of a row, whichever way the axis runs. */
const ROW_RADIUS: [number, number, number, number] = [0, BAR_RADIUS, BAR_RADIUS, 0];
const MAX_BAR_SIZE = 44;
const BAR_CATEGORY_GAP = "24%";
const BAR_GAP = 2;
/** Bars carry their value only while there are few enough for the labels to stay apart. */
const MAX_BAR_LABELS = 8;
const LINE_WIDTH = 2;
const DOT_RADIUS = 3;
const ACTIVE_DOT_RADIUS = 5;
/** Past this many points a line shows its markers only under the pointer. */
const MAX_DOTS = 24;
const AREA_OPACITY = 0.16;
/** A single line or area labels its points only while there are few enough to read. */
const MAX_POINT_LABELS = 8;
const LABEL_OFFSET = 8;
const CURSOR_DASH = "4 4";
/** Area of a scatter point in square pixels: a radius of 5. */
const POINT_AREA = 79;
const X_KEY = "x";
const Y_KEY = "y";

/** Colors, text sizes and shared axis settings, from the theme: muted labels, a light grid, no axis lines. */
function useChartLook() {
  const { color, font } = useTheme();
  const text = { fill: color.textMuted, fontSize: font.size.xs };
  return {
    color,
    grid: { stroke: color.border },
    axis: { tick: text, axisLine: false, tickLine: false, tickMargin: TICK_MARGIN, minTickGap: MIN_TICK_GAP },
    valueLabel: { fill: color.text, fontSize: font.size.xs, offset: LABEL_OFFSET },
    xTitle: (value: string | undefined) => (value ? ({ ...text, value, position: "insideBottom", offset: 0 } as const) : undefined),
    /** Runs along the axis, on its outer side. */
    yTitle: (value: string | undefined, rtl: boolean) =>
      value ? ({ ...text, value, angle: rtl ? 90 : -90, position: rtl ? "insideRight" : "insideLeft", offset: AXIS_TITLE_OFFSET, textAnchor: "middle" } as const) : undefined,
  } as const;
}

/** Category ticks along the bottom: shortened, thinned out when crowded, tilted when they cannot sit level. */
const categoryTicks = (model: ChartModel) => ({
  interval: TICK_INTERVAL,
  tickFormatter: (value: unknown) => shortLabel(String(value)),
  ...(needsTilt(model.categories.map((category) => category.label)) ? TILT : {}),
});

export function BarsChart({ model, type, rtl, wholeNumbers, formatValue, formatShare, formatAxis, xAxisLabel, yAxisLabel }: ChartRenderProps) {
  const { color, grid, axis, valueLabel, xTitle, yTitle } = useChartLook();
  const horizontal = HORIZONTAL.has(type);
  const stacked = STACKED.has(type);
  const side = rtl ? "right" : "left";
  const end = rtl ? "left" : "right";
  // Stacked segments get no labels: a short segment has no room for one.
  const labelled = !stacked && model.series.length * model.categories.length <= MAX_BAR_LABELS;
  const valueAxis = { ...axis, type: "number", tickCount: VALUE_TICKS, tickFormatter: formatAxis, allowDecimals: !wholeNumbers } as const;
  const categoryAxis = { ...axis, type: "category", dataKey: LABEL_KEY } as const;
  const label = (value: RenderableText) => (typeof value === "number" ? formatAxis(value) : "");
  const tooltip = ({ active, activeIndex }: TooltipContentProps) =>
    active && activeIndex != null ? <CategoryTooltip model={model} index={Number(activeIndex)} formatValue={formatValue} formatShare={formatShare} /> : null;
  const radius = horizontal ? ROW_RADIUS : COLUMN_RADIUS;
  const bars = model.series.map((series) => (
    <Bar
      key={series.key}
      dataKey={series.dataKey}
      name={series.label}
      fill={series.style.fill}
      maxBarSize={MAX_BAR_SIZE}
      radius={stacked ? undefined : radius}
      label={labelled ? { ...valueLabel, dataKey: series.dataKey, position: horizontal ? end : "top", formatter: label } : false}
    />
  ));

  return (
    <ResponsiveContainer width="100%" height="100%" debounce={RESIZE_DELAY_MS}>
      <BarChart
        data={model.rows}
        layout={horizontal ? "vertical" : "horizontal"}
        margin={horizontal && labelled ? { ...MARGIN, [end]: END_LABEL_ROOM } : MARGIN}
        barCategoryGap={BAR_CATEGORY_GAP}
        barGap={BAR_GAP}
        accessibilityLayer={false}
      >
        {/* Lines only across the value axis: they are what the eye follows from a bar to its number. */}
        <CartesianGrid {...grid} vertical={horizontal} horizontal={!horizontal} />
        {horizontal ? (
          <>
            <XAxis {...valueAxis} reversed={rtl} height="auto" label={xTitle(xAxisLabel)} />
            <YAxis
              {...categoryAxis}
              orientation={side}
              width="auto"
              tickFormatter={(value: unknown) => shortLabel(String(value), MAX_ROW_LABEL_CHARS)}
              label={yTitle(yAxisLabel, rtl)}
            />
          </>
        ) : (
          <>
            <XAxis {...categoryAxis} {...categoryTicks(model)} reversed={rtl} height="auto" label={xTitle(xAxisLabel)} />
            <YAxis {...valueAxis} orientation={side} width="auto" label={yTitle(yAxisLabel, rtl)} />
          </>
        )}
        <Tooltip content={tooltip} cursor={{ fill: color.surfaceAlt }} />
        {/* A stack is rounded once, at its outer end, as if it were one bar. */}
        {stacked ? <BarStack radius={radius}>{bars}</BarStack> : bars}
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Line and area charts: each series has its own dash and marker shape besides its color. */
export function LinesChart({ model, type, rtl, wholeNumbers, formatValue, formatShare, formatAxis, xAxisLabel, yAxisLabel }: ChartRenderProps) {
  const { color, grid, axis, valueLabel, xTitle, yTitle } = useChartLook();
  const area = type === "area";
  const points = model.categories.length;
  // Labels of several series would sit on top of each other where the lines cross.
  const labelled = model.series.length === 1 && points <= MAX_POINT_LABELS;
  const label = (value: RenderableText) => (typeof value === "number" ? formatAxis(value) : "");
  const tooltip = ({ active, activeIndex }: TooltipContentProps) =>
    active && activeIndex != null ? <CategoryTooltip model={model} index={Number(activeIndex)} marker formatValue={formatValue} formatShare={formatShare} /> : null;

  return (
    <ResponsiveContainer width="100%" height="100%" debounce={RESIZE_DELAY_MS}>
      <ComposedChart data={model.rows} margin={MARGIN} accessibilityLayer={false}>
        <CartesianGrid {...grid} vertical={false} />
        <XAxis {...axis} type="category" dataKey={LABEL_KEY} {...categoryTicks(model)} reversed={rtl} height="auto" label={xTitle(xAxisLabel)} />
        <YAxis
          {...axis}
          type="number"
          orientation={rtl ? "right" : "left"}
          width="auto"
          tickCount={VALUE_TICKS}
          tickFormatter={formatAxis}
          allowDecimals={!wholeNumbers}
          label={yTitle(yAxisLabel, rtl)}
        />
        <Tooltip content={tooltip} cursor={{ stroke: color.textMuted, strokeDasharray: CURSOR_DASH }} />
        {model.series.map((series) => {
          const shared = {
            dataKey: series.dataKey,
            name: series.label,
            type: "monotone",
            stroke: series.style.color,
            strokeWidth: LINE_WIDTH,
            strokeDasharray: series.style.dash || undefined,
            dot: points <= MAX_DOTS ? { symbol: series.style.symbol, r: DOT_RADIUS, fill: series.style.color, stroke: series.style.color } : false,
            activeDot: { symbol: series.style.symbol, r: ACTIVE_DOT_RADIUS },
            label: labelled ? { ...valueLabel, dataKey: series.dataKey, position: "top" as const, formatter: label } : false,
          } as const;
          return area ? <Area key={series.key} {...shared} fill={series.style.color} fillOpacity={AREA_OPACITY} /> : <Line key={series.key} {...shared} />;
        })}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Points on a number line. A category that is not a number takes its position in the list instead. */
export function PointsChart({ model, rtl, wholeNumbers, formatValue, formatNumber, formatAxis, xAxisLabel, yAxisLabel }: ChartRenderProps) {
  const { color, grid, axis, xTitle, yTitle } = useChartLook();
  const positions = model.categories.map(({ key }, index) => (Number.isFinite(Number(key)) ? Number(key) : index + 1));
  const show = (value: unknown, format: (value: number) => string) => (typeof value === "number" ? format(value) : "");
  const tooltip = ({ active, activeIndex, payload }: TooltipContentProps) => {
    if (!active) return null;
    const valueOf = (key: string) => payload.find((entry) => entry.dataKey === key)?.value;
    return <PointTooltip n={Number(activeIndex ?? 0) + 1} x={show(valueOf(X_KEY), formatNumber)} y={show(valueOf(Y_KEY), formatValue)} />;
  };

  return (
    <ResponsiveContainer width="100%" height="100%" debounce={RESIZE_DELAY_MS}>
      <ScatterChart margin={MARGIN} accessibilityLayer={false}>
        <CartesianGrid {...grid} vertical={false} />
        {/* The x axis is a number line: it is not mirrored in right-to-left pages. */}
        <XAxis {...axis} type="number" dataKey={X_KEY} height="auto" tickFormatter={formatNumber} label={xTitle(xAxisLabel)} />
        <YAxis
          {...axis}
          type="number"
          dataKey={Y_KEY}
          orientation={rtl ? "right" : "left"}
          width="auto"
          tickCount={VALUE_TICKS}
          tickFormatter={formatAxis}
          allowDecimals={!wholeNumbers}
          label={yTitle(yAxisLabel, rtl)}
        />
        <ZAxis range={[POINT_AREA, POINT_AREA]} />
        <Tooltip content={tooltip} cursor={{ stroke: color.textMuted, strokeDasharray: CURSOR_DASH }} />
        {model.series.map((series) => (
          <Scatter
            key={series.key}
            name={series.label}
            data={series.values.map((value, index) => ({ [X_KEY]: positions[index], [Y_KEY]: value }))}
            fill={series.style.color}
            shape={series.style.symbol}
          />
        ))}
      </ScatterChart>
    </ResponsiveContainer>
  );
}
