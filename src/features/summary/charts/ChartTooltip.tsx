"use client";

import { useI18n } from "@/i18n";
import { SeriesSwatch } from "./ChartLegend";
import type { ChartModel } from "./model";
import { TooltipBox, TooltipLine, TooltipName, TooltipTitle, TooltipValue } from "./primitives";

export interface ValueFormat {
  formatValue: (value: number) => string;
  /** Formats a part of the whole, 0 to 1. */
  formatShare: (share: number) => string;
}

interface CategoryTooltipProps extends ValueFormat {
  model: ChartModel;
  /** Position of the hovered category. */
  index: number;
  marker?: boolean;
}

/** Every visible series at the hovered category: swatch, name, value and its share where one exists. */
export function CategoryTooltip({ model, index, marker, formatValue, formatShare }: CategoryTooltipProps) {
  const { t, dir } = useI18n();
  const category = model.categories[index];
  if (!category) return null;
  // A chart with one series is named by its title already; a pie's slice is named by the heading.
  const named = !model.pie && model.legend.length > 1;
  return (
    // The chart box is left-to-right for the charting library; the tooltip's text follows the page again.
    <TooltipBox dir={dir}>
      <TooltipTitle>{category.label}</TooltipTitle>
      {model.series.map((series) => {
        const value = formatValue(series.values[index] ?? 0);
        const share = series.shares[index] ?? null;
        return (
          <TooltipLine key={series.key}>
            <SeriesSwatch look={model.pie ? (model.sliceStyles[index] ?? series.style) : series.style} marker={marker} />
            {named ? <TooltipName>{series.label}</TooltipName> : null}
            <TooltipValue>{share === null ? value : t("summary.chart.shareOfAll", { value, percent: formatShare(share) })}</TooltipValue>
          </TooltipLine>
        );
      })}
    </TooltipBox>
  );
}

interface PointTooltipProps {
  /** 1-based position of the point. */
  n: number;
  x: string;
  y: string;
}

export function PointTooltip({ n, x, y }: PointTooltipProps) {
  const { t, dir } = useI18n();
  return (
    <TooltipBox dir={dir}>
      <TooltipTitle>{t("charts.tooltip.point", { n })}</TooltipTitle>
      <TooltipValue>{t("charts.tooltip.xy", { x, y })}</TooltipValue>
    </TooltipBox>
  );
}
