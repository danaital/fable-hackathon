import { isTimePeriod } from "@/features/filters/periods";
import type { ViewState } from "@/features/report/viewState";
import { NAME_MAX_LENGTH, NAME_MIN_LENGTH, type ViewEntry } from "./model";

/** JSON with object keys sorted, so two equal states always produce the same text. Array order is kept: it is meaningful. */
export function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) =>
    item !== null && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)))
      : item,
  );
}

/**
 * The form two states are compared in, the same for both sides, so only changes the user made count:
 * the search term is left out (it is never saved), a filter's on/off and mandatory flags read as their defaults
 * when absent, and a filter on a preset period is compared by the period's name, because the filter bar may
 * already have turned it into today's dates. Everything else, page size included, is compared as stored.
 */
function comparable(state: ViewState): ViewState {
  return {
    ...state,
    search: "",
    filters: state.filters.map((rule) => ({
      ...rule,
      enabled: rule.enabled !== false,
      mandatory: rule.mandatory === true,
      values: isTimePeriod(rule.period) ? [] : rule.values,
    })),
  };
}

/** True when the live view differs from the loaded one ("unsaved changes"). */
export function isDirty(live: ViewState, loaded: ViewState): boolean {
  return stableStringify(comparable(live)) !== stableStringify(comparable(loaded));
}

export interface ResolveInput {
  /** Every view of the report being opened. */
  views: readonly ViewEntry[];
  /** View asked for by the navigation (the `?view=` parameter). */
  targetId?: string | null;
  /** The user's default view for this report. */
  defaultId?: string | null;
  lastUsedId?: string | null;
}

export interface Resolution {
  /** The view to open; `null` means the report's built-in default state. */
  view: ViewEntry | null;
  /** The stored default points at a view that no longer exists and should be cleared. */
  staleDefault: boolean;
}

/** Which view opens with a report: navigation target, then user default, then last used, then the first system view. */
export function resolveInitialView({ views, targetId, defaultId, lastUsedId }: ResolveInput): Resolution {
  const find = (id?: string | null) => (id ? views.find((view) => view.id === id) : undefined);
  const userDefault = find(defaultId);
  return {
    view: find(targetId) ?? userDefault ?? find(lastUsedId) ?? views.find((view) => view.system) ?? null,
    staleDefault: Boolean(defaultId) && !userDefault,
  };
}

export const NAME_ERRORS = ["required", "tooShort", "tooLong", "duplicate"] as const;
export type NameError = (typeof NAME_ERRORS)[number];

export interface NameInput {
  name: string;
  /** Names already taken in the same report. */
  taken: readonly string[];
  /** The view's own current name, which an update may keep. */
  ownName?: string;
}

const normalize = (name: string) => name.trim().toLowerCase();

export function validateName({ name, taken, ownName }: NameInput): NameError | null {
  const trimmed = name.trim();
  if (!trimmed) return "required";
  if (trimmed.replace(/\s/g, "").length < NAME_MIN_LENGTH) return "tooShort";
  if (trimmed.length > NAME_MAX_LENGTH) return "tooLong";
  const wanted = normalize(name);
  const keepsOwn = ownName !== undefined && normalize(ownName) === wanted;
  if (!keepsOwn && taken.some((other) => normalize(other) === wanted)) return "duplicate";
  return null;
}

export const VIEW_GROUPS = ["default", "system", "favorites", "custom"] as const;
export type ViewGroup = (typeof VIEW_GROUPS)[number];

export interface GroupInput {
  views: readonly ViewEntry[];
  defaultId?: string | null;
  favorites: ReadonlySet<string>;
}

/**
 * Picker groups, each view in exactly one. "default" holds the user's default view,
 * or the first system view when the user has none (that is what opens the report).
 */
export function groupViews({ views, defaultId, favorites }: GroupInput): Record<ViewGroup, ViewEntry[]> {
  const effectiveDefault = views.find((view) => view.id === defaultId) ?? views.find((view) => view.system);
  const groupOf = (view: ViewEntry): ViewGroup => {
    if (view.id === effectiveDefault?.id) return "default";
    if (favorites.has(view.id)) return "favorites";
    return view.system ? "system" : "custom";
  };
  const groups: Record<ViewGroup, ViewEntry[]> = { default: [], system: [], favorites: [], custom: [] };
  const byName = [...views].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  for (const view of byName) groups[groupOf(view)].push(view);
  return groups;
}

export interface SearchInput {
  view: ViewEntry;
  term: string;
  /** More text to search in, for example the report name. */
  extra?: string;
}

/** Case-insensitive search over a view's name and description. */
export function matchesSearch({ view, term, extra = "" }: SearchInput): boolean {
  const wanted = term.trim().toLowerCase();
  return !wanted || `${view.name} ${view.description} ${extra}`.toLowerCase().includes(wanted);
}

export interface MoveInput<T> {
  items: readonly T[];
  index: number;
  /** -1 moves the item one place earlier, 1 one place later. */
  delta: -1 | 1;
}

/** A copy of the list with one item moved a place; unchanged when the move would leave the list. */
export function moveItem<T>({ items, index, delta }: MoveInput<T>): T[] {
  const target = index + delta;
  const next = [...items];
  if (index < 0 || index >= next.length || target < 0 || target >= next.length) return next;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
