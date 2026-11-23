"use client";

import { useTheme } from "styled-components";
import { Pie, PieChart, ResponsiveContainer, Tooltip, type PieLabelRenderProps, type TooltipContentProps } from "recharts";
import { RESIZE_DELAY_MS, type ChartRenderProps } from "./CartesianCharts";
import { CategoryTooltip } from "./ChartTooltip";
import { LABEL_KEY } from "./model";
import { SliceLabel, SliceLine } from "./primitives";

/** A slice thinner than this part of the visible total gets no label. */
export const THIN_SLICE_SHARE = 0.04;
/** Radii in percent of the space, leaving room for the labels outside the circle. */
const OUTER_RADIUS = "68%";
/** The doughnut's hole: 60% of its radius. */
const HOLE_RADIUS = "41%";
/** Start at the top and run clockwise. */
const START_ANGLE = 90;
const END_ANGLE = -270;
const VALUE_KEY = "value";
const FIRST_LINE_SHIFT = "-0.3em";
const NEXT_LINE_SHIFT = "1.2em";
const NOT_FOCUSABLE = -1;

/** Pie and doughnut: one slice per visible category, each with its own texture and a value-and-share label. */
export function PieSlices({ model, type, formatValue, formatShare }: ChartRenderProps) {
  const { color } = useTheme();
  const [series] = model.series;
  const slices = model.categories.map((category, index) => ({
    [LABEL_KEY]: category.label,
    [VALUE_KEY]: series?.values[index] ?? 0,
    fill: model.sliceStyles[index]?.fill,
  }));

  const label = ({ x, y, textAnchor, index }: PieLabelRenderProps) => {
    const share = series?.shares[index] ?? 0;
    if (share < THIN_SLICE_SHARE) return null;
    return (
      <SliceLabel x={x} y={y} textAnchor={textAnchor}>
        <SliceLine x={x} dy={FIRST_LINE_SHIFT}>
          {formatValue(series?.values[index] ?? 0)}
        </SliceLine>
        <SliceLine x={x} dy={NEXT_LINE_SHIFT}>
          {formatShare(share)}
        </SliceLine>
      </SliceLabel>
    );
  };
  const tooltip = ({ active, activeIndex }: TooltipContentProps) =>
    active && activeIndex != null ? <CategoryTooltip model={model} index={Number(activeIndex)} formatValue={formatValue} formatShare={formatShare} /> : null;

  return (
    <ResponsiveContainer width="100%" height="100%" debounce={RESIZE_DELAY_MS}>
      <PieChart accessibilityLayer={false}>
        <Tooltip content={tooltip} />
        <Pie
          data={slices}
          dataKey={VALUE_KEY}
          nameKey={LABEL_KEY}
          innerRadius={type === "doughnut" ? HOLE_RADIUS : 0}
          outerRadius={OUTER_RADIUS}
          startAngle={START_ANGLE}
          endAngle={END_ANGLE}
          stroke={color.surface}
          label={label}
          labelLine={false}
          rootTabIndex={NOT_FOCUSABLE}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
