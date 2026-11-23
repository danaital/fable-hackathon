/** "All" is the option value -1 and is applied as this page size; a size at or above it means one page. */
export const ALL_OPTION = -1;
export const ALL_PAGE_SIZE = 10_000;
export const DEFAULT_SIZE_OPTIONS: readonly number[] = [25, 50, 100, ALL_OPTION];
/** A page with more rows than this renders through the windowed body. */
export const WINDOW_THRESHOLD = 100;

const FALLBACK_SIZE = 25;
const TINY_ROW_COUNT = 5;
const LIMITED_MAX_OPTION = 1_000;
const NEAR_COUNT_FACTOR = 1.5;
const PREFER_ALL_MAX_ROWS = 50;
const SWITCH_TOLERANCE = 1.2;

export const toPageSize = (option: number) => (option === ALL_OPTION ? ALL_PAGE_SIZE : option);
export const toOption = (pageSize: number) => (pageSize >= ALL_PAGE_SIZE ? ALL_OPTION : pageSize);

export interface SizeOptions {
  options: number[];
  /** True when the row count is too large to offer "All" and the big sizes. */
  limited: boolean;
}

/** The page sizes worth offering for a row count. Always returns at least one option. */
export function pageSizeOptions(count: number, configured: readonly number[] = DEFAULT_SIZE_OPTIONS): SizeOptions {
  const numeric = configured.filter((option) => option > 0).sort((a, b) => a - b);
  const smallest = numeric[0] ?? FALLBACK_SIZE;
  const all = configured.includes(ALL_OPTION) ? [ALL_OPTION] : [];

  if (count > ALL_PAGE_SIZE) {
    const capped = numeric.filter((option) => option <= LIMITED_MAX_OPTION);
    return { options: capped.length > 0 ? capped : [smallest], limited: true };
  }
  if (count >= 1 && count <= TINY_ROW_COUNT) return { options: [ALL_OPTION], limited: false };

  const secondSmallest = numeric[1] ?? smallest;
  const ceiling = count <= smallest ? smallest : count <= secondSmallest ? secondSmallest : count * NEAR_COUNT_FACTOR;
  const fitting = numeric.filter((option) => option <= ceiling);
  return { options: [...(fitting.length > 0 ? fitting : [smallest]), ...all], limited: false };
}

interface ResolveInput {
  /** The page size the view asks for. */
  wanted: number;
  options: readonly number[];
  count: number;
}

/** The offered option to use when the wanted size is not offered: "All" for small sets, else the closest size below. */
export function resolveOption({ wanted, options, count }: ResolveInput): number {
  const option = toOption(wanted);
  if (options.includes(option)) return option;
  if (count <= PREFER_ALL_MAX_ROWS && options.includes(ALL_OPTION)) return ALL_OPTION;
  const numeric = options.filter((candidate) => candidate > 0);
  const below = numeric.filter((candidate) => candidate <= wanted * SWITCH_TOLERANCE);
  return below.at(-1) ?? numeric[0] ?? options[0];
}

/** The page size to store for a chosen option: a size beyond the row count becomes "All" when that is offered. */
export function chosenPageSize({ wanted, options, count }: ResolveInput): number {
  if (wanted !== ALL_OPTION && wanted > count && options.includes(ALL_OPTION)) return ALL_PAGE_SIZE;
  return toPageSize(wanted);
}

interface PageInput {
  count: number;
  page: number;
  pageSize: number;
}

export interface PageSlice {
  /** Zero-based page, clamped to the pages that exist. */
  page: number;
  pageCount: number;
  start: number;
  end: number;
}

/** Row range of a page. An empty result still has one page. */
export function pageSlice({ count, page, pageSize }: PageInput): PageSlice {
  const pageCount = Math.max(1, Math.ceil(count / pageSize));
  const current = Math.min(Math.max(page, 0), pageCount - 1);
  const start = current * pageSize;
  return { page: current, pageCount, start, end: Math.min(start + pageSize, count) };
}

interface WindowInput {
  scrollTop: number;
  viewportHeight: number;
  rowHeight: number;
  count: number;
  overscan: number;
}

/** First and one-past-last row index to render for a scroll position. */
export function windowRange({ scrollTop, viewportHeight, rowHeight, count, overscan }: WindowInput): { start: number; end: number } {
  const first = Math.floor(scrollTop / rowHeight);
  const visible = Math.ceil(viewportHeight / rowHeight);
  return { start: Math.max(0, first - overscan), end: Math.min(count, first + visible + overscan) };
}
