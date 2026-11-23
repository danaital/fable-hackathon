import type { z } from "zod";
import { en as zodEn, he as zodHe } from "zod/locales";
import { summaryConfigSchema, type ChartConfig, type WidgetConfig } from "@/features/summary/config";
import type { Locale } from "@/lib/prefs";
import {
  IDENTIFIER_PATTERN,
  NAME_MAX,
  TEXT_MAX,
  portableFieldSchema,
  portableRelationshipSchema,
  portableReportEntitySchema,
  portableViewSchema,
  type PortableField,
  type PortableRelationship,
  type PortableReportEntity,
  type PortableView,
  type Result,
} from "./model";

// JSON import of report configuration: untrusted text in, a checked plan out. Nothing here writes anything.
// Files carry keys and names only (never ids), so the same file imports anywhere and importing twice changes nothing.

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
export const MAX_IMPORT_ITEMS = 500;
/** In the order they are applied: later sections may refer to earlier ones. */
export const SECTIONS = ["reportEntities", "entityRelationships", "fields", "widgets", "charts", "views"] as const;
export type SectionName = (typeof SECTIONS)[number];
export const IMPORT_KINDS = ["widgets", "charts", "fields", "bundle"] as const;
export type ImportKind = (typeof IMPORT_KINDS)[number];

interface ItemMap {
  reportEntities: PortableReportEntity;
  entityRelationships: PortableRelationship;
  fields: PortableField;
  widgets: WidgetConfig;
  charts: ChartConfig;
  views: PortableView;
}
/** Everything configurable about one report, in portable form. */
export type ReportConfig = { [K in SectionName]: ItemMap[K][] };

export type FileError = "empty" | "tooLarge" | "invalidJson" | "wrongShape" | "tooManyItems";
export type IssueCode = "schema" | "identifier" | "duplicate" | "unknownField" | "unknownEntity" | "unknownColumn" | "sameEntity" | "aliasTaken" | "tooLong";
/** `path` is where in the item; `detail` is the offending value or the validator's message. Both are shown as text. */
export interface PlanIssue {
  code: IssueCode;
  path: string;
  detail: string;
}
export const ITEM_STATUSES = ["create", "update", "unchanged", "invalid"] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];
export interface PlanItem {
  section: SectionName;
  name: string;
  status: ItemStatus;
  issues: PlanIssue[];
}
export type PlanProblem = "baseEntity";
export interface ImportPlan {
  items: PlanItem[];
  counts: Record<ItemStatus, number>;
  problems: PlanProblem[];
  /** The report's configuration after the import. Null when anything is invalid: an import applies fully or not at all. */
  next: ReportConfig | null;
}

export interface ImportContext {
  /** Known entity keys, each with its column names. */
  entities: ReadonlyMap<string, ReadonlySet<string>>;
  locale: Locale;
}

const ZOD_MESSAGES: Record<Locale, z.core.$ZodErrorMap> = { en: zodEn().localeError, he: zodHe().localeError };
// Properties whose text names a field of the report, anywhere inside a widget, a chart or a view state.
const FIELD_REF_KEYS = new Set(["field", "dataField", "groupByField", "labelField", "dateField", "groupBy", "requireSingleValueOn", "columns", "compareField"]);
const SORT_LIST_KEY = "sorts";
const SORT_FIELD_KEY = "key";
const INDEX = /^\d+$/;

export function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) =>
    item !== null && typeof item === "object" && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => (a < b ? -1 : 1))) : item,
  );
}

/** Size cap first, then JSON.parse: the text is never evaluated. */
export function parseJsonText(text: string): Result<unknown, FileError> {
  if (!text.trim()) return { ok: false, error: "empty" };
  if (new TextEncoder().encode(text).length > MAX_IMPORT_BYTES) return { ok: false, error: "tooLarge" };
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false, error: "invalidJson" };
  }
}

type SectionLists = Partial<Record<SectionName, unknown[]>>;

/** A bare array or `{ mode?, <kind>: [...] }` for one kind; an object of sections for a bundle. Anything else is refused. */
function sectionLists(kind: ImportKind, value: unknown): Result<SectionLists, FileError> {
  const wrongShape = { ok: false, error: "wrongShape" } as const;
  const allowed: readonly SectionName[] = kind === "bundle" ? SECTIONS : [kind];
  const isList = Array.isArray(value);
  if (value === null || typeof value !== "object" || (isList && kind === "bundle")) return wrongShape;
  const lists: SectionLists = {};
  for (const [key, entry] of isList ? [[kind, value] as const] : Object.entries(value)) {
    if (key === "mode" && entry === "upsert") continue;
    if (key === "reportName" && kind === "bundle" && typeof entry === "string" && entry.length <= NAME_MAX) continue;
    const section = allowed.find((name) => name === key);
    if (!section || !Array.isArray(entry)) return wrongShape;
    lists[section] = entry;
  }
  if (kind !== "bundle" && !lists[kind]) return wrongShape;
  const total = Object.values(lists).reduce((sum, list) => sum + list.length, 0);
  return total > MAX_IMPORT_ITEMS ? { ok: false, error: "tooManyItems" } : { ok: true, value: lists };
}

type Parsed<T> = { value: T; issues: [] } | { value: null; issues: PlanIssue[] };

/** `skip` drops the leading path segments a wrapper added. A failed identifier pattern gets its own, clearer code. */
function fromZod<T>(result: z.ZodSafeParseResult<T>, skip = 0): Parsed<T> {
  if (result.success) return { value: result.data, issues: [] };
  return {
    value: null,
    issues: result.error.issues.map((issue) => ({
      code: issue.code === "invalid_format" && "pattern" in issue && issue.pattern === String(IDENTIFIER_PATTERN) ? "identifier" : "schema",
      path: issue.path.slice(skip).join("."),
      detail: issue.message,
    })),
  };
}

interface Section<T> {
  parse: (raw: unknown, error: z.core.$ZodErrorMap) => Parsed<T>;
  /** What makes an item "the same item" on import. Shown in the preview. */
  identity: (item: T) => string;
  /** Rules that need the target environment. */
  check: (item: T, context: CheckContext) => PlanIssue[];
}
interface CheckContext extends ImportContext {
  fieldKeys: ReadonlySet<string>;
  /** The section's list so far: the baseline plus the items already accepted. */
  current: readonly unknown[];
}

const WRAPPED_PATH = 2;
const aliasSuffix = (alias: string | null) => (alias ? ` : ${alias}` : "");
const issue = (code: IssueCode, path: string, detail: string): PlanIssue => ({ code, path, detail });

function walkStrings(value: unknown, path: string[], visit: (path: string[], text: string) => void): void {
  if (typeof value === "string") visit(path, value);
  else if (Array.isArray(value)) value.forEach((item, index) => walkStrings(item, [...path, String(index)], visit));
  else if (value !== null && typeof value === "object") Object.entries(value).forEach(([key, item]) => walkStrings(item, [...path, key], visit));
}

/** Over-long texts, and (when `fieldKeys` is given) references to fields the target report does not have. */
function textIssues(item: unknown, fieldKeys?: ReadonlySet<string>): PlanIssue[] {
  const issues: PlanIssue[] = [];
  walkStrings(item, [], (path, text) => {
    const names = path.filter((segment) => !INDEX.test(segment));
    const leaf = names.at(-1) ?? "";
    const isFieldRef = FIELD_REF_KEYS.has(leaf) || (leaf === SORT_FIELD_KEY && names.at(-2) === SORT_LIST_KEY);
    if (text.length > TEXT_MAX) issues.push(issue("tooLong", path.join("."), String(TEXT_MAX)));
    else if (fieldKeys && isFieldRef && !fieldKeys.has(text)) issues.push(issue("unknownField", path.join("."), text));
  });
  return issues;
}

function columnIssues(context: ImportContext, entityKey: string, columns: readonly (readonly [path: string, name: string])[]): PlanIssue[] {
  const known = context.entities.get(entityKey);
  if (!known) return [issue("unknownEntity", "", entityKey)];
  return columns.filter(([, name]) => !known.has(name)).map(([path, name]) => issue("unknownColumn", path, name));
}

const refCheck = (item: unknown, { fieldKeys }: CheckContext) => textIssues(item, fieldKeys);

const SECTION_RULES: { [K in SectionName]: Section<ItemMap[K]> } = {
  reportEntities: {
    parse: (raw, error) => fromZod(portableReportEntitySchema.safeParse(raw, { error })),
    identity: (item) => `${item.entityKey}${aliasSuffix(item.alias)}`,
    check: (item, context) => {
      const clash = (context.current as PortableReportEntity[]).some((other) => other.alias !== null && other.alias === item.alias && other.entityKey !== item.entityKey);
      return [...columnIssues(context, item.entityKey, []), ...(clash ? [issue("aliasTaken", "alias", item.alias ?? "")] : [])];
    },
  },
  entityRelationships: {
    parse: (raw, error) => fromZod(portableRelationshipSchema.safeParse(raw, { error })),
    identity: (item) => `${item.sourceEntityKey} → ${item.targetEntityKey}${aliasSuffix(item.alias)}`,
    check: (item, context) => [
      ...(item.sourceEntityKey === item.targetEntityKey ? [issue("sameEntity", "targetEntityKey", item.targetEntityKey)] : []),
      ...columnIssues(context, item.sourceEntityKey, [["sourceColumn", item.sourceColumn]]),
      ...columnIssues(context, item.targetEntityKey, [["targetColumn", item.targetColumn]]),
    ],
  },
  fields: {
    parse: (raw, error) => fromZod(portableFieldSchema.safeParse(raw, { error })),
    identity: (item) => item.key,
    check: (item, context) => [...columnIssues(context, item.entityKey, [["columnName", item.columnName]]), ...textIssues(item)],
  },
  widgets: {
    parse: (raw, error) => {
      const parsed = fromZod(summaryConfigSchema.safeParse({ widgets: [raw], charts: [] }, { error }), WRAPPED_PATH);
      return parsed.value ? { value: parsed.value.widgets[0], issues: [] } : parsed;
    },
    identity: (item) => item.id,
    check: refCheck,
  },
  charts: {
    parse: (raw, error) => {
      const parsed = fromZod(summaryConfigSchema.safeParse({ widgets: [], charts: [raw] }, { error }), WRAPPED_PATH);
      return parsed.value ? { value: parsed.value.charts[0], issues: [] } : parsed;
    },
    identity: (item) => item.id,
    check: refCheck,
  },
  views: {
    parse: (raw, error) => fromZod(portableViewSchema.safeParse(raw, { error })),
    identity: (item) => item.name,
    check: (item, context) => textIssues(item.state, context.fieldKeys),
  },
};

const NAME_KEYS = ["id", "name", "key", "entityKey"] as const;

/** A label for an item that failed validation: its own name when it has one, otherwise its position. */
function rawName(raw: unknown, index: number): string {
  const source: Record<string, unknown> = raw !== null && typeof raw === "object" ? { ...raw } : {};
  const found = NAME_KEYS.map((key) => source[key]).find((value) => typeof value === "string" && value.length > 0 && value.length <= NAME_MAX);
  return typeof found === "string" ? found : `#${index + 1}`;
}

interface SectionInput<K extends SectionName> {
  section: K;
  raws: readonly unknown[];
  baseline: readonly ItemMap[K][];
  context: ImportContext & { fieldKeys: ReadonlySet<string> };
}

/** Upsert by identity: an existing item is replaced in place, a new one is appended, nothing is ever removed. */
function planSection<K extends SectionName>({ section, raws, baseline, context }: SectionInput<K>): { items: PlanItem[]; next: ItemMap[K][] } {
  const rules = SECTION_RULES[section];
  const next = [...baseline];
  const seen = new Set<string>();
  const items = raws.map((raw, index): PlanItem => {
    const parsed = rules.parse(raw, ZOD_MESSAGES[context.locale]);
    if (parsed.value === null) return { section, name: rawName(raw, index), status: "invalid", issues: parsed.issues };
    const { value } = parsed;
    const name = rules.identity(value);
    const issues = rules.check(value, { ...context, current: next });
    if (seen.has(name)) issues.push(issue("duplicate", "", name));
    seen.add(name);
    if (issues.length > 0) return { section, name, status: "invalid", issues };
    const position = next.findIndex((other) => rules.identity(other) === name);
    const status: ItemStatus = position < 0 ? "create" : stableStringify(next[position]) === stableStringify(value) ? "unchanged" : "update";
    if (position < 0) next.push(value);
    else next[position] = value;
    return { section, name, status, issues };
  });
  return { items, next };
}

/** Marking an imported row as base un-marks the report's other rows; the report must end with exactly one base. */
function settleBase(rows: PortableReportEntity[], imported: ReadonlySet<string>): { rows: PortableReportEntity[]; ok: boolean } {
  const identity = SECTION_RULES.reportEntities.identity;
  const importedBases = rows.filter((row) => row.isBaseEntity && imported.has(identity(row)));
  const settled = importedBases.length === 1 ? rows.map((row) => (row === importedBases[0] ? row : { ...row, isBaseEntity: false })) : rows;
  return { rows: settled, ok: importedBases.length <= 1 && settled.filter((row) => row.isBaseEntity).length === 1 };
}

export interface PlanInput {
  kind: ImportKind;
  /** Parsed JSON, still untrusted. */
  value: unknown;
  baseline: ReportConfig;
  context: ImportContext;
}

/** The preview and the result in one: what each item would do, and the configuration to store when all of it is valid. */
export function planImport({ kind, value, baseline, context }: PlanInput): Result<ImportPlan, FileError> {
  const lists = sectionLists(kind, value);
  if (!lists.ok) return lists;
  const next: ReportConfig = { ...baseline };
  const items: PlanItem[] = [];
  const problems: PlanProblem[] = [];
  const plan = <K extends SectionName>(section: K): void => {
    const raws = lists.value[section];
    if (!raws) return;
    // Widgets, charts and views may only name fields the report has once the file's own fields are in.
    const fieldKeys = new Set(next.fields.map((field) => field.key));
    const result = planSection({ section, raws, baseline: baseline[section], context: { ...context, fieldKeys } });
    items.push(...result.items);
    Object.assign(next, { [section]: result.next }); // one section replaced; TypeScript cannot follow the generic key here
  };
  SECTIONS.forEach(plan);
  if (lists.value.reportEntities?.length) {
    const imported = new Set(items.filter((item) => item.section === "reportEntities" && item.status !== "invalid").map((item) => item.name));
    const settled = settleBase(next.reportEntities, imported);
    next.reportEntities = settled.rows;
    if (!settled.ok) problems.push("baseEntity");
  }
  const counts: Record<ItemStatus, number> = { create: 0, update: 0, unchanged: 0, invalid: 0 };
  items.forEach((item) => (counts[item.status] += 1));
  return { ok: true, value: { items, counts, problems, next: counts.invalid === 0 && problems.length === 0 ? next : null } };
}

export const EXPORT_SUFFIX: Record<ImportKind, string> = { widgets: "widgets", charts: "charts", fields: "fields", bundle: "config" };

/** One kind exports as a bare array; a bundle as an object of every section. Ids and timestamps are never included. */
export function exportConfig(kind: ImportKind, reportName: string, config: ReportConfig): unknown {
  return kind === "bundle" ? { reportName, ...config } : config[kind];
}
