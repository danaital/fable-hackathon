import { z } from "zod";

// Declarative summary configuration: plain JSON per report, no functions.
// Imported JSON is validated with these schemas; unknown keys are rejected.

export const CALCULATIONS = ["count", "unique", "sum", "average", "averageRounded", "median", "minimum", "maximum"] as const;
export const WIDGET_TYPES = ["basicCalculation", "custom", "dualValue", "comparison", "ranking"] as const;
export const CHART_TYPES = ["bar", "horizontalBar", "multiBar", "line", "area", "pie", "doughnut", "scatter", "free"] as const;
export const FILTER_OPERATORS = ["in", "notIn"] as const;
/** Display-condition operators, named like the shared filter operators. */
export const CONDITION_OPERATORS = [
  "equals",
  "notEquals",
  "greaterThan",
  "greaterThanOrEqual",
  "lessThan",
  "lessThanOrEqual",
  "between",
  "notBetween",
  "in",
  "notIn",
  "isNull",
  "isNotNull",
] as const;
export const AGGREGATIONS = ["sum", "average", "count", "min", "max"] as const;
export const VALUE_KINDS = ["number", "date", "category", "boolean"] as const;
export const SORT_DIRECTIONS = ["asc", "desc"] as const;
export const PERIOD_TYPES = [
  "this_month",
  "this_quarter",
  "this_year",
  "month_to_date",
  "quarter_to_date",
  "year_to_date",
  "last_7_days",
  "last_30_days",
  "last_90_days",
] as const;
export const PERIOD_RELATIONSHIPS = ["previous_period", "same_period_last_year"] as const;
export const SERIES_AGGREGATIONS = ["count", "sum", "average"] as const;
export const SORT_MODES = ["value", "label", "none"] as const;
export const GRANULARITIES = ["day", "month", "year"] as const;
export const TONES = ["success", "warning", "danger", "info", "neutral"] as const;

export const MIN_TOP_N = 1;
export const MAX_TOP_N = 20;
export const DEFAULT_TOP_N = 5;
export const DEFAULT_CHART_LIMIT = 20;
export const DEFAULT_MAX_SERIES = 10;

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

const key = z.string().min(1);
const isoDay = z.string().regex(ISO_DAY);
const calculation = z.enum(CALCULATIONS);
/** Text carried by the config itself, in both languages, so imported JSON needs no message keys. */
const text = z.strictObject({ en: z.string().min(1), he: z.string().min(1) });
const cell = z.union([z.string(), z.number(), z.boolean(), z.null()]);

/** A filter with an empty `values` list is ignored. Several filters combine with AND. */
const filter = z.strictObject({ field: key, operator: z.enum(FILTER_OPERATORS).default("in"), values: z.array(cell) });

const conditionRule = z.strictObject({
  subject: z.enum(["rowCount", "field"]),
  /** Needed when subject is "field"; a field rule without it is skipped. */
  field: key.optional(),
  /** Number: the field is aggregated, then compared. Other kinds: each non-empty cell is tested. */
  valueKind: z.enum(VALUE_KINDS).default("number"),
  aggregation: z.enum(AGGREGATIONS).default("sum"),
  operator: z.enum(CONDITION_OPERATORS),
  value: cell.optional(),
  valueTo: cell.optional(),
  values: z.array(cell).optional(),
  /** Per-cell kinds: must all cells pass, or any one of them. */
  match: z.enum(["all", "any"]).default("all"),
});

const displayCondition = z.strictObject({
  /** Met only when the rows hold exactly one distinct value on at least one of these fields. */
  requireSingleValueOn: z.array(key).optional(),
  rules: z.array(conditionRule).optional(),
  relation: z.enum(["and", "or"]).default("and"),
});

const shared = {
  id: key,
  title: text,
  displayCondition: displayCondition.optional(),
  /** Calculate over every loaded row instead of the filtered rows. */
  ignoreActiveFilters: z.boolean().optional(),
  /** What the card adds to the current view when the user explores it. Absent: explore is unavailable. */
  drill: z
    .strictObject({
      filters: z.array(filter).default([]),
      groupBy: z.array(key).optional(),
      sorts: z.array(z.strictObject({ key, direction: z.enum(SORT_DIRECTIONS) })).optional(),
    })
    .optional(),
};

const widgetShared = { ...shared, subtitle: text.optional(), tone: z.enum(TONES).optional(), filters: z.array(filter).optional() };

const dualSide = z.strictObject({
  title: text,
  field: key.optional(),
  filters: z.array(filter).optional(),
  calculation: calculation.default("count"),
});

const periodShape = { type: z.enum(PERIOD_TYPES).optional(), start: isoDay.optional(), end: isoDay.optional() };
const period = z.strictObject(periodShape);

const widget = z.discriminatedUnion("type", [
  z.strictObject({
    ...widgetShared,
    type: z.literal("basicCalculation"),
    calculation: calculation.default("count"),
    field: key.optional(),
    /** With an averaging calculation: the mean of the per-group averages, so each group counts once. */
    groupByField: key.optional(),
  }),
  z.strictObject({
    ...widgetShared,
    type: z.literal("custom"),
    mode: z.literal("simple").default("simple"),
    field: key,
    aggregation: z.enum(AGGREGATIONS).default("sum"),
  }),
  z.strictObject({ ...widgetShared, type: z.literal("dualValue"), left: dualSide, right: dualSide }),
  z.strictObject({
    ...widgetShared,
    type: z.literal("comparison"),
    field: key.optional(),
    operation: calculation.default("count"),
    dateField: key,
    /** Absent: start of this year to today. Explicit start and end win over the period type. */
    currentPeriod: period.optional(),
    /** Explicit start and end win over the relationship. */
    previousPeriod: z
      .strictObject({ relationship: z.enum(PERIOD_RELATIONSHIPS).default("previous_period"), start: isoDay.optional(), end: isoDay.optional() })
      .optional(),
  }),
  z.strictObject({
    ...widgetShared,
    type: z.literal("ranking"),
    labelField: key,
    field: key.optional(),
    calculation: calculation.optional(),
    topN: z.number().int().min(MIN_TOP_N).max(MAX_TOP_N).default(DEFAULT_TOP_N),
    showShare: z.boolean().optional(),
    valueSuffix: text.optional(),
    /** A label whose last word is one of these is ranked under the text before it ("Acme Retail" under "Acme"). */
    mergeSuffixes: z.array(z.string().min(1)).optional(),
  }),
]);

const chart = z.strictObject({
  ...shared,
  type: z.enum(CHART_TYPES),
  /** Counted per distinct value; inside a series breakdown it is the field that is summed or averaged. */
  dataField: key,
  /** Category field. Absent: the data field's own values are the categories. */
  groupBy: key.optional(),
  sortBy: z.enum(SORT_MODES).default("value"),
  limit: z.number().int().min(1).default(DEFAULT_CHART_LIMIT),
  /** Sum the categories past the limit into one "Other" category instead of dropping them. */
  showOther: z.boolean().optional(),
  /** Bucket size for a date category. Absent: month. */
  granularity: z.enum(GRANULARITIES).optional(),
  series: z
    .strictObject({
      field: key,
      aggregation: z.enum(SERIES_AGGREGATIONS).default("count"),
      maxSeries: z.number().int().min(1).default(DEFAULT_MAX_SERIES),
    })
    .optional(),
  dateRange: z.strictObject({ ...periodShape, field: key }).optional(),
  showLegend: z.boolean().optional(),
  xAxisLabel: text.optional(),
  yAxisLabel: text.optional(),
  insights: z.strictObject({ title: text.optional(), lines: z.array(text) }).optional(),
});

const uniqueIds = (items: readonly { id: string }[]) => new Set(items.map((item) => item.id)).size === items.length;

export const summaryConfigSchema = z.strictObject({
  widgets: z.array(widget).refine(uniqueIds, { message: "widget ids must be unique" }),
  charts: z.array(chart).refine(uniqueIds, { message: "chart ids must be unique" }),
});

export type SummaryConfig = z.infer<typeof summaryConfigSchema>;
/** The shape to write by hand or import: fields with defaults may be left out. */
export type SummaryConfigInput = z.input<typeof summaryConfigSchema>;
export type WidgetConfig = z.infer<typeof widget>;
export type ChartConfig = z.infer<typeof chart>;
export type WidgetType = (typeof WIDGET_TYPES)[number];
export type ChartType = (typeof CHART_TYPES)[number];
export type Calculation = (typeof CALCULATIONS)[number];
export type PeriodType = (typeof PERIOD_TYPES)[number];
export type PeriodRelationship = (typeof PERIOD_RELATIONSHIPS)[number];
export type PeriodConfig = z.infer<typeof period>;
export type ConfigFilter = z.infer<typeof filter>;
export type DisplayCondition = z.infer<typeof displayCondition>;
export type ConditionRule = z.infer<typeof conditionRule>;
export type Aggregation = (typeof AGGREGATIONS)[number];
export type DrillConfig = NonNullable<WidgetConfig["drill"]>;
export type LocalizedText = z.infer<typeof text>;
export type DualSide = z.infer<typeof dualSide>;
