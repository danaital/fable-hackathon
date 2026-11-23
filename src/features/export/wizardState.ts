import type { ReportDef } from "@/data/types";
import { anchorKeys } from "@/features/grid/columns";
import type { SortRule } from "@/features/grid/sort";
import type { ViewState } from "@/features/report/viewState";
import type { Locale } from "@/lib/prefs";
import type { ExportChart } from "./chartSource";
import { resolveColumns, resolveRules, type PageContext } from "./plan";
import {
  STEP_IDS,
  type DataSource,
  type ExportTemplate,
  type FileDesign,
  type FileTemplate,
  type RuleSource,
  type SectionStyle,
  type WizardState,
} from "./schema";
import { calcsFor } from "./summary";

const DEFAULT_FONT = { fontFamily: "Calibri", fontSize: 11, italic: false, underline: false } as const;
const BLACK = "#000000";
const WHITE = "#FFFFFF";
const section = (background: string, fontColor: string, bold: boolean): SectionStyle => ({ ...DEFAULT_FONT, background, fontColor, bold });

export const DEFAULT_DESIGN: FileDesign = {
  header: section("#4472C4", WHITE, true),
  values: section(WHITE, BLACK, false),
  summaryRow: section("#E2EFDA", BLACK, true),
  groupSummaryRow: section("#FFF2CC", BLACK, true),
};

export interface InitialInput {
  report: ReportDef;
  view: ViewState;
  locale: Locale;
  charts: readonly ExportChart[];
  fileTemplates: readonly FileTemplate[];
  /** "Total" in the app's language; the user can change it. */
  totalLabel: string;
}

/** Every open of the wizard starts from this. */
export function initialState({ report, view, locale, charts, fileTemplates, totalLabel }: InitialInput): WizardState {
  // The page's own totals row seeds the summary row, limited to the calculations the export offers for the field.
  const summaryFields = report.fields.flatMap((field) => {
    const calc = view.totals[field.key];
    return calc && calcsFor(field.type).includes(calc) ? [{ field: field.key, calc }] : [];
  });
  const preset = fileTemplates.find((template) => template.isDefault);
  const anchors = anchorKeys(report.fields);

  return {
    step: STEP_IDS[0],
    format: "xlsx",
    csvDelimiter: "comma",
    source: "current",
    otherViewId: null,
    templateId: null,
    selectedFields: [...anchors, ...view.columns.filter((key) => !anchors.includes(key))],
    filtersSource: "from_view",
    customFilters: [],
    filterRelation: "and",
    sortsSource: "from_view",
    customSorts: [],
    summary: { enabled: summaryFields.length > 0, label: totalLabel, fields: summaryFields },
    grouping: { enabled: false, groupBy: [], innerSummary: false, outputMode: "single_sheet", includeGrandTotal: true },
    charts: { enabled: false, selected: charts.map((chart) => chart.id) },
    formatting: {
      language: locale,
      useDefaultLanguage: true,
      dateOrder: "dmy",
      dateDelimiter: ".",
      timeFormat: "24h",
      dateTimeStructure: "date_time",
      decimals: "auto",
      thousands: true,
    },
    fileName: "",
    includeMetadata: true,
    includeFilters: true,
    designMode: preset ? "existing" : "custom",
    fileTemplateId: preset?.id ?? null,
    design: preset?.design ?? DEFAULT_DESIGN,
  };
}

export type WizardAction =
  | { type: "patch"; patch: Partial<WizardState> }
  | { type: "setSource"; source: DataSource; defaults: WizardState }
  | { type: "pickView"; id: string }
  | { type: "applyTemplate"; template: ExportTemplate; fileTemplates: readonly FileTemplate[]; defaults: WizardState }
  | { type: "setFiltersSource"; source: RuleSource }
  | { type: "setSortsSource"; source: RuleSource; shown: readonly SortRule[] };

/** A new data source makes the later steps derive their filters and sorts from it again. */
function ruleDefaults(source: DataSource): Pick<WizardState, "filtersSource" | "sortsSource" | "customFilters" | "filterRelation" | "customSorts"> {
  const ruleSource: RuleSource = source === "custom" ? "current" : "from_view";
  return { filtersSource: ruleSource, sortsSource: ruleSource, customFilters: [], filterRelation: "and", customSorts: [] };
}

/** What a template writes, back at its defaults: nothing leaks out of template mode. */
const templateKeys = ({ format, selectedFields, summary, grouping, charts, designMode, fileTemplateId, design }: WizardState) => ({
  format,
  selectedFields,
  summary,
  grouping,
  charts,
  designMode,
  fileTemplateId,
  design,
});

interface ApplyTemplateInput {
  state: WizardState;
  template: ExportTemplate;
  fileTemplates: readonly FileTemplate[];
  defaults: WizardState;
}

/**
 * The one way a template fills an export, used by the wizard and by one-click template export.
 * Filters and sorts are read from the template when the file is built ("from view or template").
 * A styling preset that no longer exists falls back to the default design.
 */
export function applyTemplate({ state, template, fileTemplates, defaults }: ApplyTemplateInput): WizardState {
  const preset = fileTemplates.find((candidate) => candidate.id === template.fileTemplateId);
  return {
    ...state,
    ...ruleDefaults("template"),
    source: "template",
    templateId: template.id,
    otherViewId: null,
    format: template.format,
    selectedFields: template.columns,
    summary: template.summary,
    grouping: template.grouping,
    charts: template.charts,
    designMode: preset ? "existing" : defaults.designMode,
    fileTemplateId: preset?.id ?? defaults.fileTemplateId,
    design: preset?.design ?? defaults.design,
  };
}

export function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case "patch":
      return { ...state, ...action.patch };
    case "setSource":
      return {
        ...state,
        ...(state.source === "template" ? templateKeys(action.defaults) : {}),
        ...ruleDefaults(action.source),
        source: action.source,
        otherViewId: null,
        templateId: null,
      };
    case "pickView":
      return { ...state, ...ruleDefaults(state.source), otherViewId: action.id };
    case "applyTemplate":
      return applyTemplate({ state, ...action });
    case "setFiltersSource":
      // "Build custom" starts empty with AND; the other sources are read when the file is built.
      return { ...state, filtersSource: action.source, customFilters: [], filterRelation: "and" };
    case "setSortsSource":
      // "Build custom" starts from the sorts that were being shown.
      return { ...state, sortsSource: action.source, customSorts: action.source === "custom" ? [...action.shown] : [] };
  }
}

type TemplateContent = Omit<ExportTemplate, "id" | "name" | "reportId" | "isDefault" | "createdAt" | "updatedAt">;

/** What "Save as template" stores: the columns, filters and sorts as resolved now, plus grouping, summary and charts. */
export function templateContent(state: WizardState, page: PageContext, fileTemplates: readonly FileTemplate[]): TemplateContent {
  const rules = resolveRules(state, page);
  // Only a preset the design still equals is referenced; an edited design is not that preset any more.
  const preset = fileTemplates.find((template) => template.id === state.fileTemplateId);
  const unchanged = preset && JSON.stringify(preset.design) === JSON.stringify(state.design);
  return {
    format: state.format,
    columns: resolveColumns(state, page).map((field) => field.key),
    filters: [...rules.filters],
    filterRelation: rules.relation,
    sorts: [...rules.sorts],
    grouping: state.grouping,
    summary: state.summary,
    charts: state.charts,
    fileTemplateId: unchanged ? preset.id : null,
  };
}
