import { describe, expect, it } from "vitest";
import { defaultFileName, neutralizeFormula, sanitizeFileName, uniqueHeaders, uniqueSheetName } from "./safety";

describe("neutralizeFormula", () => {
  it.each(["=1+1", "+1", "-1", "@SUM(A1)", "\tx", "\rx", "  =HYPERLINK(1)"])("prefixes %j with an apostrophe", (text) => {
    expect(neutralizeFormula(text)).toBe(`'${text}`);
  });

  it("leaves ordinary text alone", () => {
    expect(neutralizeFormula("Cedar Studio")).toBe("Cedar Studio");
    expect(neutralizeFormula("a=b")).toBe("a=b");
    expect(neutralizeFormula("")).toBe("");
  });
});

describe("sanitizeFileName", () => {
  it("strips path separators, illegal and control characters", () => {
    expect(sanitizeFileName("../../etc/passwd")).toBe("etc-passwd");
    expect(sanitizeFileName('a\\b:c*d?"e<f>g|h')).toBe("a-b-c-d-e-f-g-h");
    expect(sanitizeFileName("re\u0000po‮rt\n")).toBe("report");
  });

  it("keeps Hebrew and caps the length", () => {
    expect(sanitizeFileName("דוח הזמנות")).toBe("דוח הזמנות");
    expect(sanitizeFileName("x".repeat(500))).toHaveLength(120);
  });

  it("returns empty when nothing usable is left", () => {
    expect(sanitizeFileName(" ../ ")).toBe("");
  });
});

describe("defaultFileName", () => {
  const now = new Date("2026-11-23T10:20:30.000Z");

  it("builds title, markers and a timestamp", () => {
    expect(defaultFileName({ title: "Orders & Returns", filtered: true, custom: true, now })).toBe(
      "orders-returns-filtered-custom-2026-11-23T10-20-30",
    );
  });

  it("keeps a Hebrew title", () => {
    expect(defaultFileName({ title: "הזמנות", filtered: false, custom: false, now })).toBe("הזמנות-2026-11-23T10-20-30");
  });
});

describe("uniqueSheetName", () => {
  it("replaces illegal characters and cuts to 31 characters", () => {
    const name = uniqueSheetName("Status: late / [x]? * and a very long tail of text", new Set(), "Group 1");
    expect(name).toBe("Status_ late _ _x__ _ and a ver");
    expect(name.length).toBeLessThanOrEqual(31);
  });

  it("makes names unique without passing 31 characters, ignoring case", () => {
    const taken = new Set<string>();
    const long = "a".repeat(40);
    expect(uniqueSheetName("Data", taken, "x")).toBe("Data");
    expect(uniqueSheetName("data", taken, "x")).toBe("data (2)");
    expect(uniqueSheetName("DATA", taken, "x")).toBe("DATA (3)");
    uniqueSheetName(long, taken, "x");
    expect(uniqueSheetName(long, taken, "x")).toBe(`${"a".repeat(27)} (2)`);
  });

  it("uses the fallback for an empty name", () => {
    expect(uniqueSheetName("  ", new Set(), "Group 3")).toBe("Group 3");
  });
});

describe("uniqueHeaders", () => {
  it("numbers repeats and skips numbers already taken", () => {
    expect(uniqueHeaders(["Name", "Name", "Name (2)", "Name"])).toEqual(["Name", "Name (2)", "Name (2) (2)", "Name (3)"]);
  });
});
