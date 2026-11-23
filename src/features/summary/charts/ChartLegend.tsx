"use client";

import { useId } from "react";
import { Symbols } from "recharts";
import { Chip } from "@/components/ui";
import { useI18n } from "@/i18n";
import type { SeriesStyle } from "../palette";
import type { LegendItem } from "./model";
import { LegendButton, LegendDetail, LegendList, LegendRow, SvgDefs, Swatch, SwatchRect, SwatchSvg } from "./primitives";

const SWATCH = 16;
const SWATCH_CENTER = SWATCH / 2;
const SWATCH_RADIUS = 2;
/** Area of the marker symbol, in square pixels. */
const SYMBOL_AREA = 90;
const BOUNDS = { width: SWATCH, height: SWATCH };

interface SwatchProps {
  look: SeriesStyle;
  /** Line, area and scatter series are told apart by their marker shape; bars and slices by their texture. */
  marker?: boolean;
}

/** The look of one series or slice in small: its color plus its texture or marker shape, so color is never the only cue. */
export function SeriesSwatch({ look, marker }: SwatchProps) {
  const id = useId();
  const { fill, color, symbol } = look;
  const Texture = typeof fill === "string" ? null : fill.definition;
  return (
    <Swatch aria-hidden>
      <SwatchSvg viewBox={`0 0 ${SWATCH} ${SWATCH}`} focusable="false">
        {marker ? (
          <Symbols type={symbol} cx={SWATCH_CENTER} cy={SWATCH_CENTER} size={SYMBOL_AREA} fill={color} />
        ) : (
          <>
            <SwatchRect width={SWATCH} height={SWATCH} rx={SWATCH_RADIUS} fill={color} />
            {Texture ? (
              <>
                <SvgDefs>
                  <Texture id={id} color={color} bounds={BOUNDS} />
                </SvgDefs>
                <SwatchRect width={SWATCH} height={SWATCH} rx={SWATCH_RADIUS} fill={`url(#${id})`} />
              </>
            ) : null}
          </>
        )}
      </SwatchSvg>
    </Swatch>
  );
}

interface ChartLegendProps {
  title: string;
  items: readonly LegendItem[];
  /** One item per line, for the legend beside an enlarged pie. */
  column?: boolean;
  marker?: boolean;
  onToggle: (key: string) => void;
}

/** The legend: one toggle button per series or slice. A hidden item is pressed, struck through and named "hidden". */
export function ChartLegend({ title, items, column, marker, onToggle }: ChartLegendProps) {
  const { t } = useI18n();
  return (
    <LegendList $column={column} aria-label={t("summary.chart.legend", { title })}>
      {items.map((item) => (
        <LegendRow key={item.key}>
          <LegendButton
            type="button"
            aria-pressed={item.hidden}
            aria-label={t(item.hidden ? "charts.legend.itemHidden" : "charts.legend.item", { label: item.label, title })}
            onClick={() => onToggle(item.key)}
          >
            <SeriesSwatch look={item.style} marker={marker} />
            {item.isOther ? <Chip>{item.label}</Chip> : item.label}
            {item.detail ? <LegendDetail>{item.detail}</LegendDetail> : null}
          </LegendButton>
        </LegendRow>
      ))}
    </LegendList>
  );
}
