"use client";

import { useTheme } from "styled-components";
import { Label, Pie, PieChart, ResponsiveContainer, Tooltip, type TooltipContentProps } from "recharts";
import { RESIZE_DELAY_MS, type ChartRenderProps } from "./CartesianCharts";
import { CategoryTooltip } from "./ChartTooltip";
import { LABEL_KEY } from "./model";

/** Radii in percent of the space. Names and shares are in the legend, so the circle needs no room for labels around it. */
const OUTER_RADIUS = "88%";
/** The doughnut's hole: five eighths of its radius, wide enough for the total. */
const HOLE_RADIUS = "55%";
/** Start at the top and run clockwise. */
const START_ANGLE = 90;
const END_ANGLE = -270;
/** A thin gap in the surface color keeps neighbouring slices apart. */
const SLICE_GAP_WIDTH = 2;
const SLICE_CORNER = 3;
/** The total sits just above the middle of the hole and its caption just below, so the pair looks centered. */
const TOTAL_SHIFT = 2;
const CAPTION_SHIFT = 6;
const VALUE_KEY = "value";
const NOT_FOCUSABLE = -1;

/** Pie and doughnut: one slice per visible category, each with its own texture. A doughnut shows the total in its hole. */
export function PieSlices({ model, type, formatValue, formatShare, formatAxis, totalLabel }: ChartRenderProps) {
  const { color, font } = useTheme();
  const [series] = model.series;
  const slices = model.categories.map((category, index) => ({
    [LABEL_KEY]: category.label,
    [VALUE_KEY]: series?.values[index] ?? 0,
    fill: model.sliceStyles[index]?.fill,
  }));
  const total = (series?.values ?? []).reduce((sum, value) => sum + value, 0);
  const doughnut = type === "doughnut";
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
          innerRadius={doughnut ? HOLE_RADIUS : 0}
          outerRadius={OUTER_RADIUS}
          startAngle={START_ANGLE}
          endAngle={END_ANGLE}
          cornerRadius={SLICE_CORNER}
          stroke={color.surface}
          strokeWidth={SLICE_GAP_WIDTH}
          label={false}
          labelLine={false}
          rootTabIndex={NOT_FOCUSABLE}
        >
          {doughnut && totalLabel ? (
            <>
              <Label position="centerBottom" dy={TOTAL_SHIFT} value={formatAxis(total)} fill={color.text} fontSize={font.size.xl} fontWeight={font.weight.medium} />
              <Label position="centerTop" dy={CAPTION_SHIFT} value={totalLabel} fill={color.textMuted} fontSize={font.size.xs} />
            </>
          ) : null}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
}
