import { z } from "zod";
import { AGGREGATES, FILTER_RELATIONS, type FilterRule } from "@/features/report/viewState";
import { LOCALES } from "@/lib/prefs";
import { HEX_COLOR } from "./design";

export const EXPORT_FORMATS = ["xlsx", "csv"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export const DATA_SOURCES = ["current", "current_by_definition", "other_view", "template", "custom"] as const;
export type DataSource = (typeof DATA_SOURCES)[number];

/** Where the filters, and separately the sorts, of the export come from. */
export const RULE_SOURCES = ["from_view", "current", "custom"] as const;
export type RuleSource = (typeof RULE_SOURCES)[number];

export const OUTPUT_MODES = ["single_sheet", "split_sheets", "split_with_summary"] as const;
export type OutputMode = (typeof OUTPUT_MODES)[number];

export const DATE_ORDERS = ["dmy", "mdy", "ymd"] as const;
export const DATE_DELIMITERS = [".", "/", "-"] as const;
export const TIME_FORMATS = ["24h", "12h"] as const;
export const DATE_TIME_STRUCTURES = ["date_time", "time_date"] as const;
export const DECIMAL_CHOICES = ["auto", "0", "1", "2", "3"] as const;
export const CSV_DELIMITERS = ["comma", "semicolon", "tab"] as const;
export type CsvDelimiter = (typeof CSV_DELIMITERS)[number];
export const DESIGN_MODES = ["existing", "custom"] as const;
export const FONT_FAMILIES = ["Calibri", "Arial", "Times New Roman", "Verdana", "Tahoma", "Georgia", "Courier New"] as const;
export const DESIGN_SECTIONS = ["header", "values", "summaryRow", "groupSummaryRow"] as const;
export type DesignSection = (typeof DESIGN_SECTIONS)[number];

// HOOK(currency): add "currency" after "fields" here, then give it a component in steps/registry.tsx
// and a skip rule in steps.ts. Nothing else in the wizard needs to change.
export const STEP_IDS = [
  "format",
  "source",
  "fields",
  "filters",
  "sort",
  "summary",
  "grouping",
  "charts",
  "settings",
  "fileName",
  "fileTemplate",
  "review",
] as const;
export type StepId = (typeof STEP_IDS)[number];

export const FONT_SIZE_MIN = 8;
export const FONT_SIZE_MAX = 24;
export const NAME_MIN = 2;
export const NAME_MAX = 255;

const cellValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

// Loose: the filters feature adds keys of its own to a rule, and they must survive being saved in a template.
export const filterRuleSchema: z.ZodType<FilterRule> = z.looseObject({
  id: z.string(),
  field: z.string(),
  operator: z.string(),
  values: z.array(cellValueSchema),
  compareField: z.string().optional(),
  fieldOperator: z.string().optional(),
  period: z.string().optional(),
  mandatory: z.boolean().optional(),
  enabled: z.boolean().optional(),
});

export const sortRuleSchema = z.object({ key: z.string(), direction: z.enum(["asc", "desc"]) });

const summaryFieldSchema = z.object({ field: z.string(), calc: z.enum(AGGREGATES) });
export type SummaryField = z.infer<typeof summaryFieldSchema>;

export const summarySchema = z.object({ enabled: z.boolean(), label: z.string(), fields: z.array(summaryFieldSchema) });
export type SummarySettings = z.infer<typeof summarySchema>;

export const groupingSchema = z.object({
  enabled: z.boolean(),
  groupBy: z.array(z.string()),
  innerSummary: z.boolean(),
  outputMode: z.enum(OUTPUT_MODES),
  includeGrandTotal: z.boolean(),
});
export type GroupingSettings = z.infer<typeof groupingSchema>;

export const chartsSchema = z.object({ enabled: z.boolean(), selected: z.array(z.string()) });
export type ChartsSettings = z.infer<typeof chartsSchema>;

const formattingSchema = z.object({
  language: z.enum(LOCALES),
  useDefaultLanguage: z.boolean(),
  dateOrder: z.enum(DATE_ORDERS),
  dateDelimiter: z.enum(DATE_DELIMITERS),
  timeFormat: z.enum(TIME_FORMATS),
  dateTimeStructure: z.enum(DATE_TIME_STRUCTURES),
  decimals: z.enum(DECIMAL_CHOICES),
  thousands: z.boolean(),
});
export type FormattingSettings = z.infer<typeof formattingSchema>;

const sectionStyleSchema = z.object({
  background: z.string().regex(HEX_COLOR),
  fontFamily: z.enum(FONT_FAMILIES),
  fontSize: z.number(),
  fontColor: z.string().regex(HEX_COLOR),
  bold: z.boolean(),
  italic: z.boolean(),
  underline: z.boolean(),
});
export type SectionStyle = z.infer<typeof sectionStyleSchema>;

export const designSchema = z.object({
  header: sectionStyleSchema,
  values: sectionStyleSchema,
  summaryRow: sectionStyleSchema,
  groupSummaryRow: sectionStyleSchema,
});
export type FileDesign = z.infer<typeof designSchema>;

export const wizardStateSchema = z.object({
  step: z.enum(STEP_IDS),
  format: z.enum(EXPORT_FORMATS),
  csvDelimiter: z.enum(CSV_DELIMITERS),
  source: z.enum(DATA_SOURCES),
  otherViewId: z.string().nullable(),
  templateId: z.string().nullable(),
  /** Column keys in file order. Used by the "custom" and "template" sources. */
  selectedFields: z.array(z.string()),
  filtersSource: z.enum(RULE_SOURCES),
  customFilters: z.array(filterRuleSchema),
  filterRelation: z.enum(FILTER_RELATIONS),
  sortsSource: z.enum(RULE_SOURCES),
  customSorts: z.array(sortRuleSchema),
  summary: summarySchema,
  grouping: groupingSchema,
  charts: chartsSchema,
  formatting: formattingSchema,
  fileName: z.string(),
  includeMetadata: z.boolean(),
  includeFilters: z.boolean(),
  designMode: z.enum(DESIGN_MODES),
  fileTemplateId: z.string().nullable(),
  design: designSchema,
});
export type WizardState = z.infer<typeof wizardStateSchema>;

const stamps = { createdAt: z.string(), updatedAt: z.string() };
const name = z.string().min(NAME_MIN).max(NAME_MAX);

export const exportTemplateSchema = z.object({
  id: z.string(),
  name,
  reportId: z.string(),
  format: z.enum(EXPORT_FORMATS),
  columns: z.array(z.string()),
  filters: z.array(filterRuleSchema),
  filterRelation: z.enum(FILTER_RELATIONS),
  sorts: z.array(sortRuleSchema),
  grouping: groupingSchema,
  summary: summarySchema,
  charts: chartsSchema,
  fileTemplateId: z.string().nullable(),
  isDefault: z.boolean(),
  ...stamps,
});
export type ExportTemplate = z.infer<typeof exportTemplateSchema>;

export const fileTemplateSchema = z.object({
  id: z.string(),
  name,
  description: z.string().max(NAME_MAX),
  design: designSchema,
  isDefault: z.boolean(),
  ...stamps,
});
export type FileTemplate = z.infer<typeof fileTemplateSchema>;
