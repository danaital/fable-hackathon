import { AVERAGING, measure, roundTo } from "./aggregate";
import type { Aggregation, Calculation, DualSide, WidgetConfig, WidgetType } from "./config";
import { currentWindow, inWindow, previousWindow, type DateWindow } from "./periods";
import { rank, type RankingResult } from "./ranking";
import { SummaryNotice, applyConfigFilters, type Fields, type Measure, type NoticeCode, type Rows } from "./values";

export const TREND_DIRECTIONS = ["up", "down", "flat"] as const;
export type TrendDirection = (typeof TREND_DIRECTIONS)[number];

/** What a widget card receives. "notice" replaces a number that would be false; "error" is a failed calculation. */
export type WidgetResult =
  | { kind: "value"; measure: Measure }
  | { kind: "dual"; left: Measure; right: Measure }
  | {
      kind: "comparison";
      current: Measure;
      previous: Measure;
      trendPct: number;
      direction: TrendDirection;
      windows: { current: DateWindow; previous: DateWindow };
    }
  | { kind: "ranking"; ranking: RankingResult }
  | { kind: "notice"; code: NoticeCode; detail: string }
  | { kind: "error" };

const CUSTOM_AVERAGE_DECIMALS = 1;
const CUSTOM_CALCULATION: Record<Aggregation, Calculation> = { sum: "sum", average: "average", count: "count", min: "minimum", max: "maximum" };
const PERCENT = 100;

type WidgetOf<T extends WidgetType> = Extract<WidgetConfig, { type: T }>;

interface CalcInput<T extends WidgetType> {
  widget: WidgetOf<T>;
  /** Rows after the widget's own filters. */
  rows: Rows;
  fields: Fields;
  /** "Now" for comparison periods; injectable so tests are stable. */
  now: Date;
}

function side(config: DualSide, { rows, fields }: Pick<CalcInput<"dualValue">, "rows" | "fields">): Measure {
  return measure({ rows: applyConfigFilters(rows, config.filters), calculation: config.calculation, key: config.field, fields });
}

function trend(current: number, previous: number): { trendPct: number; direction: TrendDirection } {
  const trendPct = previous === 0 ? 0 : (Math.abs(current - previous) / Math.abs(previous)) * PERCENT;
  return { trendPct, direction: current > previous ? "up" : current < previous ? "down" : "flat" };
}

const WIDGET_CALCULATORS: { [T in WidgetType]: (input: CalcInput<T>) => WidgetResult } = {
  basicCalculation: ({ widget, rows, fields }) => {
    const { calculation, field, groupByField } = widget;
    if (groupByField && field && AVERAGING.has(calculation)) {
      // Each group counts once: the mean of per-group averages, through the ranking routine so both cards agree.
      const { summaryValue, unit } = rank({ rows, labelKey: groupByField, valueKey: field, calculation, fields });
      return { kind: "value", measure: { value: summaryValue, unit } };
    }
    return { kind: "value", measure: measure({ rows, calculation, key: field, fields }) };
  },

  custom: ({ widget, rows, fields }) => {
    const result = measure({ rows, calculation: CUSTOM_CALCULATION[widget.aggregation], key: widget.field, fields });
    const value = widget.aggregation === "average" ? roundTo(result.value, CUSTOM_AVERAGE_DECIMALS) : result.value;
    return { kind: "value", measure: { ...result, value } };
  },

  dualValue: ({ widget, rows, fields }) => ({
    kind: "dual",
    left: side(widget.left, { rows, fields }),
    right: side(widget.right, { rows, fields }),
  }),

  comparison: ({ widget, rows, fields, now }) => {
    const { currentPeriod, previousPeriod, dateField, operation, field } = widget;
    const current = currentWindow(currentPeriod, now);
    const explicit = Boolean(currentPeriod?.start && currentPeriod.end);
    const previous = previousWindow({ current, type: explicit ? undefined : currentPeriod?.type, previous: previousPeriod });
    const valueIn = (window: DateWindow) =>
      measure({ rows: rows.filter((row) => inWindow(row[dateField], window)), calculation: operation, key: field, fields });
    const [currentValue, previousValue] = [valueIn(current), valueIn(previous)];
    return {
      kind: "comparison",
      current: currentValue,
      previous: previousValue,
      ...trend(currentValue.value, previousValue.value),
      windows: { current, previous },
    };
  },

  ranking: ({ widget, rows, fields }) => ({
    kind: "ranking",
    ranking: rank({
      rows,
      labelKey: widget.labelField,
      valueKey: widget.field,
      calculation: widget.calculation,
      fields,
      showShare: widget.showShare,
      mergeSuffixes: widget.mergeSuffixes,
    }),
  }),
};

function run<T extends WidgetType>(type: T, input: CalcInput<T>): WidgetResult {
  return WIDGET_CALCULATORS[type](input);
}

interface CalculateWidgetInput {
  widget: WidgetConfig;
  rows: Rows;
  fields: Fields;
  now: Date;
}

/** Never throws: one widget failing must not take the grid down. */
export function calculateWidget({ widget, rows, fields, now }: CalculateWidgetInput): WidgetResult {
  try {
    // A comparison's date window replaces any widget filter on its date field; the other filters still apply.
    const filters = widget.type === "comparison" ? widget.filters?.filter((filter) => filter.field !== widget.dateField) : widget.filters;
    return run(widget.type, { widget, rows: applyConfigFilters(rows, filters), fields, now });
  } catch (error) {
    if (error instanceof SummaryNotice) return { kind: "notice", code: error.code, detail: error.detail };
    return { kind: "error" };
  }
}
