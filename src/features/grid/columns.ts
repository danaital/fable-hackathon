import type { FieldDef } from "@/data/types";
import type { ViewState } from "@/features/report/viewState";

export const COLUMN_LISTS = ["visible", "hidden"] as const;
export type ColumnList = (typeof COLUMN_LISTS)[number];
export const OTHER_LIST: Record<ColumnList, ColumnList> = { visible: "hidden", hidden: "visible" };

/** The column layout being edited: every field key is in exactly one of the two ordered lists. */
export type ColumnDraft = Record<ColumnList, string[]>;

// shortcut: the first field (the row's identity) is the anchor column, because FieldDef has no anchor flag yet.
// Upgrade to reading `field.anchor` when the shared type gains it.
export function anchorKeys(fields: readonly FieldDef[]): string[] {
  return fields.slice(0, 1).map((field) => field.key);
}

/**
 * Splits the fields into visible and hidden. Anchors are always visible and come first, in their own order.
 * Unknown keys drop out, known ones keep their place, and fields the view does not list are hidden.
 */
export function toDraft(fields: readonly FieldDef[], columns: readonly string[]): ColumnDraft {
  const anchors = anchorKeys(fields);
  const known = new Set(fields.map((field) => field.key));
  const visible = [...new Set([...anchors, ...columns.filter((key) => known.has(key))])];
  return { visible, hidden: fields.map((field) => field.key).filter((key) => !visible.includes(key)) };
}

export const defaultDraft = (fields: readonly FieldDef[]): ColumnDraft =>
  toDraft(
    fields,
    fields.map((field) => field.key),
  );

export const sameDraft = (a: ColumnDraft, b: ColumnDraft) => a.visible.join() === b.visible.join() && a.hidden.join() === b.hidden.join();

export const listOf = (draft: ColumnDraft, key: string): ColumnList => (draft.visible.includes(key) ? "visible" : "hidden");

/** The keys one action moves: every selected key of the same list when the key is selected, else just the key. */
export function moveSet(draft: ColumnDraft, key: string, selected: ReadonlySet<string>): string[] {
  if (!selected.has(key)) return [key];
  return draft[listOf(draft, key)].filter((candidate) => selected.has(candidate));
}

interface MoveByInput {
  draft: ColumnDraft;
  key: string;
  delta: 1 | -1;
  anchors: readonly string[];
}

/** Moves a column one place up or down inside its list. Anchors do not move, and nothing moves above them. */
export function moveBy({ draft, key, delta, anchors }: MoveByInput): ColumnDraft {
  const list = listOf(draft, key);
  const keys = draft[list];
  const from = keys.indexOf(key);
  const to = from + delta;
  const floor = list === "visible" ? anchors.length : 0;
  if (anchors.includes(key) || to < floor || to >= keys.length) return draft;
  const next = [...keys];
  [next[from], next[to]] = [next[to], next[from]];
  return { ...draft, [list]: next };
}

interface PlaceInput {
  draft: ColumnDraft;
  keys: readonly string[];
  target: ColumnList;
  /** Insert before this key of the target list; omit to add at the end. */
  before?: string;
  anchors: readonly string[];
}

/**
 * Moves columns into a list at a position; used by drag and drop, the visibility switch and the keyboard.
 * Refused (draft returned unchanged) when it would hide an anchor or land before one.
 */
export function place({ draft, keys, target, before, anchors }: PlaceInput): ColumnDraft {
  const moving = keys.filter((key) => !(target === "visible" && anchors.includes(key)));
  const hidesAnchor = target === "hidden" && keys.some((key) => anchors.includes(key));
  const beforeAnchor = before !== undefined && anchors.includes(before);
  if (moving.length === 0 || hidesAnchor || beforeAnchor || (before !== undefined && moving.includes(before))) return draft;

  const without = (list: readonly string[]) => list.filter((key) => !moving.includes(key));
  const rest = without(draft[target]);
  const index = before === undefined ? -1 : rest.indexOf(before);
  const at = index === -1 ? rest.length : index;
  const other = OTHER_LIST[target];
  return { ...draft, [other]: without(draft[other]), [target]: [...rest.slice(0, at), ...moving, ...rest.slice(at)] };
}

interface SearchInput {
  field: FieldDef;
  label: string;
  term: string;
}

/** Case-insensitive match on the column's key or its translated label. */
export function matchesColumn({ field, label, term }: SearchInput): boolean {
  const needle = term.trim().toLowerCase();
  return needle === "" || field.key.toLowerCase().includes(needle) || label.toLowerCase().includes(needle);
}

export const FILTER_ACTIONS = ["remove", "clear"] as const;
export type FilterAction = (typeof FILTER_ACTIONS)[number];

/** What the columns panel hands back when the user confirms. */
export interface ColumnsResult {
  /** Visible field keys, in display order. */
  columns: string[];
  /** What to do with filters on columns that are now hidden; omit to leave the filters alone. */
  filters?: { action: FilterAction; fields: readonly string[] };
}

/** Writes a confirmed column layout into the view. Mandatory filters are never removed or cleared. */
export function applyColumns(view: ViewState, { columns, filters }: ColumnsResult): ViewState {
  if (!filters) return { ...view, columns };
  const targeted = (rule: ViewState["filters"][number]) => filters.fields.includes(rule.field) && !rule.mandatory;
  const next: Record<FilterAction, () => ViewState["filters"]> = {
    remove: () => view.filters.filter((rule) => !targeted(rule)),
    clear: () => view.filters.map((rule) => (targeted(rule) ? { ...rule, values: [], period: undefined } : rule)),
  };
  return { ...view, columns, filters: next[filters.action]() };
}
