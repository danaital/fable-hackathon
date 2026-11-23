"use client";

import { useTheme } from "styled-components";
import {
  Area,
  Bar,
  BarChart,
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
  xAxisLabel?: string;
  yAxisLabel?: string;
}

const HORIZONTAL: ReadonlySet<ChartType> = new Set(["horizontalBar"]);
/** Several bars per category are stacked. */
const STACKED: ReadonlySet<ChartType> = new Set(["multiBar"]);
const STACK_ID = "stack";
export const RESIZE_DELAY_MS = 50;
const MARGIN = { top: 16, right: 16, bottom: 8, left: 8 };
/** Room above the highest point for an area chart's boxed labels. */
const AREA_MARGIN = { ...MARGIN, top: 28 };
const GRID_DASH = "3 3";
/** Category ticks tilt once there are more of them than this. */
const TILT_FROM = 6;
const TILT_ANGLE = -45;
const HALO_WIDTH = 3;
const LINE_WIDTH = 2;
const DOT_RADIUS = 3;
const ACTIVE_DOT_RADIUS = 5;
const AREA_OPACITY = 0.25;
/** An area chart labels its points only while there are few enough to read. */
const MAX_POINT_LABELS = 16;
const LABEL_BOX = { rx: 2, padding: 2 };
/** Area of a scatter point in square pixels: a radius of 5. */
const POINT_AREA = 79;
const X_KEY = "x";
const Y_KEY = "y";

/** Colors and text sizes of axes, grid and labels, from the theme. */
function useChartLook() {
  const { color, font } = useTheme();
  return {
    color,
    tick: { fill: color.textMuted, fontSize: font.size.xs },
    axisLine: { stroke: color.border },
    axisTitle: (value: string | undefined) => (value ? { value, fill: color.textMuted, fontSize: font.size.xs } : undefined),
  };
}

const tilt = (count: number) => (count > TILT_FROM ? ({ angle: TILT_ANGLE, textAnchor: "end", interval: 0 } as const) : {});

export function BarsChart({ model, type, rtl, wholeNumbers, formatValue, formatShare, xAxisLabel, yAxisLabel }: ChartRenderProps) {
  const { color, tick, axisLine, axisTitle } = useChartLook();
  const horizontal = HORIZONTAL.has(type);
  const stacked = STACKED.has(type);
  const side = rtl ? "right" : "left";
  const valueAxis = { type: "number", tickFormatter: formatValue, allowDecimals: !wholeNumbers, tick, axisLine, tickLine: axisLine } as const;
  const categoryAxis = { type: "category", dataKey: LABEL_KEY, tick, axisLine, tickLine: axisLine } as const;
  // A stacked label sits in its own segment; an empty segment gets none.
  const label = (value: RenderableText) => (typeof value === "number" && value !== 0 ? formatValue(value) : "");
  const tooltip = ({ active, activeIndex }: TooltipContentProps) =>
    active && activeIndex != null ? <CategoryTooltip model={model} index={Number(activeIndex)} formatValue={formatValue} formatShare={formatShare} /> : null;

  return (
    <ResponsiveContainer width="100%" height="100%" debounce={RESIZE_DELAY_MS}>
      <BarChart data={model.rows} layout={horizontal ? "vertical" : "horizontal"} margin={MARGIN} accessibilityLayer={false}>
        <CartesianGrid stroke={color.border} strokeDasharray={GRID_DASH} vertical={horizontal} horizontal={!horizontal} />
        {horizontal ? (
          <>
            <XAxis {...valueAxis} reversed={rtl} height="auto" label={axisTitle(xAxisLabel)} />
            <YAxis {...categoryAxis} orientation={side} width="auto" label={axisTitle(yAxisLabel)} />
          </>
        ) : (
          <>
            <XAxis {...categoryAxis} {...tilt(model.categories.length)} reversed={rtl} height="auto" label={axisTitle(xAxisLabel)} />
            <YAxis {...valueAxis} orientation={side} width="auto" label={axisTitle(yAxisLabel)} />
          </>
        )}
        <Tooltip content={tooltip} cursor={{ fill: color.surfaceAlt }} />
        {model.series.map((series) => (
          <Bar
            key={series.key}
            dataKey={series.dataKey}
            name={series.label}
            fill={series.style.fill}
            stackId={stacked ? STACK_ID : undefined}
            label={{ dataKey: series.dataKey, position: "center", fill: color.text, halo: { stroke: color.surface, strokeWidth: HALO_WIDTH }, formatter: label }}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Line and area charts: each series has its own dash and marker shape besides its color. */
export function LinesChart({ model, type, rtl, wholeNumbers, formatValue, formatShare, xAxisLabel, yAxisLabel }: ChartRenderProps) {
  const { color, tick, axisLine, axisTitle } = useChartLook();
  const area = type === "area";
  const labelled = area && model.series.length * model.categories.length <= MAX_POINT_LABELS;
  const label = (value: RenderableText) => (typeof value === "number" ? formatValue(value) : "");
  const tooltip = ({ active, activeIndex }: TooltipContentProps) =>
    active && activeIndex != null ? <CategoryTooltip model={model} index={Number(activeIndex)} marker formatValue={formatValue} formatShare={formatShare} /> : null;

  return (
    <ResponsiveContainer width="100%" height="100%" debounce={RESIZE_DELAY_MS}>
      <ComposedChart data={model.rows} margin={area ? AREA_MARGIN : MARGIN} accessibilityLayer={false}>
        <CartesianGrid stroke={color.border} strokeDasharray={GRID_DASH} vertical={false} />
        <XAxis
          type="category"
          dataKey={LABEL_KEY}
          {...tilt(model.categories.length)}
          reversed={rtl}
          height="auto"
          tick={tick}
          axisLine={axisLine}
          tickLine={axisLine}
          label={axisTitle(xAxisLabel)}
        />
        <YAxis
          type="number"
          orientation={rtl ? "right" : "left"}
          width="auto"
          tickFormatter={formatValue}
          allowDecimals={!wholeNumbers}
          tick={tick}
          axisLine={axisLine}
          tickLine={axisLine}
          label={axisTitle(yAxisLabel)}
        />
        <Tooltip content={tooltip} cursor={{ stroke: color.textMuted }} />
        {model.series.map((series) => {
          const shared = {
            dataKey: series.dataKey,
            name: series.label,
            type: "monotone",
            stroke: series.style.color,
            strokeWidth: LINE_WIDTH,
            strokeDasharray: series.style.dash || undefined,
            dot: { symbol: series.style.symbol, r: DOT_RADIUS, fill: series.style.color, stroke: series.style.color },
            activeDot: { symbol: series.style.symbol, r: ACTIVE_DOT_RADIUS },
          } as const;
          return area ? (
            <Area
              key={series.key}
              {...shared}
              fill={series.style.color}
              fillOpacity={AREA_OPACITY}
              label={labelled ? { dataKey: series.dataKey, position: "top", fill: color.text, background: { ...LABEL_BOX, fill: color.surface, stroke: color.border }, formatter: label } : false}
            />
          ) : (
            <Line key={series.key} {...shared} />
          );
        })}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Points on a number line. A category that is not a number takes its position in the list instead. */
export function PointsChart({ model, rtl, wholeNumbers, formatValue, formatNumber, xAxisLabel, yAxisLabel }: ChartRenderProps) {
  const { color, tick, axisLine, axisTitle } = useChartLook();
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
        <CartesianGrid stroke={color.border} strokeDasharray={GRID_DASH} />
        {/* The x axis is a number line: it is not mirrored in right-to-left pages. */}
        <XAxis type="number" dataKey={X_KEY} height="auto" tickFormatter={formatNumber} tick={tick} axisLine={axisLine} tickLine={axisLine} label={axisTitle(xAxisLabel)} />
        <YAxis
          type="number"
          dataKey={Y_KEY}
          orientation={rtl ? "right" : "left"}
          width="auto"
          tickFormatter={formatValue}
          allowDecimals={!wholeNumbers}
          tick={tick}
          axisLine={axisLine}
          tickLine={axisLine}
          label={axisTitle(yAxisLabel)}
        />
        <ZAxis range={[POINT_AREA, POINT_AREA]} />
        <Tooltip content={tooltip} cursor={{ stroke: color.textMuted, strokeDasharray: GRID_DASH }} />
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
