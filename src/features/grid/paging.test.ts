import { describe, expect, it } from "vitest";
import { ALL_OPTION, ALL_PAGE_SIZE, chosenPageSize, pageSizeOptions, pageSlice, resolveOption, windowRange } from "./paging";

const ALL = ALL_OPTION;

describe("pageSizeOptions", () => {
  it("offers only All for one to five rows", () => {
    expect(pageSizeOptions(1).options).toEqual([ALL]);
    expect(pageSizeOptions(5).options).toEqual([ALL]);
  });

  it("offers sizes up to the smallest or second smallest option for small sets", () => {
    expect(pageSizeOptions(0).options).toEqual([25, ALL]);
    expect(pageSizeOptions(20).options).toEqual([25, ALL]);
    expect(pageSizeOptions(40).options).toEqual([25, 50, ALL]);
  });

  it("offers a size when it is at most the count or within one and a half times it", () => {
    expect(pageSizeOptions(60).options).toEqual([25, 50, ALL]);
    expect(pageSizeOptions(70).options).toEqual([25, 50, 100, ALL]);
    expect(pageSizeOptions(2000, [25, 50, 100, 200]).options).toEqual([25, 50, 100, 200]);
  });

  it("drops All and sizes above 1,000 past 10,000 rows, and says the list is limited", () => {
    expect(pageSizeOptions(ALL_PAGE_SIZE).limited).toBe(false);
    expect(pageSizeOptions(10_001, [25, 500, 2000, ALL])).toEqual({ options: [25, 500], limited: true });
  });

  it("always offers at least one option", () => {
    expect(pageSizeOptions(50_000, [5000]).options).toEqual([5000]);
    expect(pageSizeOptions(30, []).options).toEqual([25]);
  });
});

describe("resolveOption", () => {
  it("keeps an offered size and maps the stored All size to the All option", () => {
    expect(resolveOption({ wanted: 50, options: [25, 50, ALL], count: 60 })).toBe(50);
    expect(resolveOption({ wanted: ALL_PAGE_SIZE, options: [25, ALL], count: 20 })).toBe(ALL);
  });

  it("prefers All for up to fifty rows, else the largest size within 1.2 times the wanted one", () => {
    expect(resolveOption({ wanted: 100, options: [25, 50, ALL], count: 40 })).toBe(ALL);
    expect(resolveOption({ wanted: 200, options: [25, 50, 100, ALL], count: 90 })).toBe(100);
    expect(resolveOption({ wanted: ALL_PAGE_SIZE, options: [25, 500], count: 20_000 })).toBe(500);
    expect(resolveOption({ wanted: 10, options: [25, 50], count: 20_000 })).toBe(25);
  });
});

describe("chosenPageSize", () => {
  it("turns a size beyond the row count into All when All is offered", () => {
    expect(chosenPageSize({ wanted: 50, options: [25, 50, ALL], count: 40 })).toBe(ALL_PAGE_SIZE);
    expect(chosenPageSize({ wanted: 50, options: [25, 50], count: 40 })).toBe(50);
    expect(chosenPageSize({ wanted: 25, options: [25, 50, ALL], count: 40 })).toBe(25);
    expect(chosenPageSize({ wanted: ALL, options: [25, ALL], count: 400 })).toBe(ALL_PAGE_SIZE);
  });
});

describe("pageSlice", () => {
  it("clamps the page and counts an empty result as one page", () => {
    expect(pageSlice({ count: 0, page: 3, pageSize: 25 })).toEqual({ page: 0, pageCount: 1, start: 0, end: 0 });
    expect(pageSlice({ count: 60, page: 9, pageSize: 25 })).toEqual({ page: 2, pageCount: 3, start: 50, end: 60 });
    expect(pageSlice({ count: 60, page: 0, pageSize: ALL_PAGE_SIZE }).pageCount).toBe(1);
  });
});

describe("windowRange", () => {
  it("renders the visible rows plus the overscan, inside the row count", () => {
    const base = { viewportHeight: 400, rowHeight: 40, count: 1000, overscan: 5 };
    expect(windowRange({ ...base, scrollTop: 0 })).toEqual({ start: 0, end: 15 });
    expect(windowRange({ ...base, scrollTop: 4000 })).toEqual({ start: 95, end: 115 });
    expect(windowRange({ ...base, scrollTop: 39_900 })).toEqual({ start: 992, end: 1000 });
  });
});
