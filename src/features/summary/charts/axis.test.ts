import { describe, expect, it } from "vitest";
import { MAX_TICK_CHARS, chartHeight, compactFormatter, needsTilt, shortLabel } from "./axis";

describe("shortLabel", () => {
  it("keeps a label that fits and cuts a long one with an ellipsis", () => {
    expect(shortLabel("Delivered")).toBe("Delivered");
    const cut = shortLabel("International partner sales");
    expect(cut).toBe("International…");
    expect(cut.length).toBeLessThanOrEqual(MAX_TICK_CHARS);
  });

  it("does not leave a space before the ellipsis", () => {
    expect(shortLabel("Billing question now", 9)).toBe("Billing…");
  });
});

describe("needsTilt", () => {
  it("keeps a few short labels level and tilts many or long ones", () => {
    expect(needsTilt(["Web", "Phone", "Mobile", "Partner"])).toBe(false);
    expect(needsTilt(["Billing question", "Damaged item", "Feature request", "Late delivery"])).toBe(true);
    expect(needsTilt(Array.from({ length: 13 }, () => "Nov 2026"))).toBe(true);
    expect(needsTilt([])).toBe(false);
  });
});

describe("compactFormatter", () => {
  it("shortens large numbers and leaves small ones whole", () => {
    const format = compactFormatter("en", { type: "number" });
    expect(format(12)).toBe("12");
    expect(format(1234)).toBe("1.2K");
    expect(format(1_500_000)).toBe("1.5M");
  });

  it("keeps the currency sign and the percent sign", () => {
    expect(compactFormatter("en", { type: "currency", currency: "USD" })(15_000)).toBe("$15K");
    expect(compactFormatter("en", { type: "percent" })(17)).toBe("17%");
  });

  it("falls back to a plain number for a currency code that is not valid", () => {
    expect(compactFormatter("en", { type: "currency", currency: "not a code" })(1234)).toBe("1.2K");
    expect(compactFormatter("en", { type: "currency" })(1234)).toBe("1.2K");
  });
});

describe("chartHeight", () => {
  it("gives every chart the card height and the dialog more", () => {
    expect(chartHeight({ type: "bar", categories: 40, enlarged: false })).toBe(280);
    expect(chartHeight({ type: "pie", categories: 3, enlarged: true })).toBe(440);
  });

  it("grows a horizontal bar chart with its rows, up to a limit", () => {
    expect(chartHeight({ type: "horizontalBar", categories: 6, enlarged: false })).toBe(280);
    expect(chartHeight({ type: "horizontalBar", categories: 14, enlarged: false })).toBe(14 * 26 + 40);
    expect(chartHeight({ type: "horizontalBar", categories: 100, enlarged: false })).toBe(560);
  });
});
