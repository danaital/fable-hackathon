import { describe, expect, it } from "vitest";
import { DEFAULT_FORMATTING, type FormattingSettings } from "@/features/settings/schema";
import { createFormatters } from "./format";

const with_ = (patch: Partial<FormattingSettings>) => createFormatters("en", { ...DEFAULT_FORMATTING, ...patch });
// Local times, because dates are shown in the browser's own time zone.
const DATE = "2026-02-10";
const DATE_TIME = new Date(2026, 1, 10, 14, 5).toISOString();
const MORNING = new Date(2026, 1, 10, 9, 5).toISOString();

describe("createFormatters(locale) without settings keeps today's output", () => {
  const legacy = createFormatters("en");
  it("numbers, percent and currency", () => {
    expect(legacy.number(1234.567)).toBe("1,234.57");
    expect(legacy.percent(15)).toBe("15%");
    expect(legacy.currency(1234.5, "EUR")).toBe("€1,234.50");
    expect(legacy.currency(10)).toBe("US$10.00");
  });
  it("dates and countries", () => {
    expect(legacy.date("2026-02-10T12:00:00Z")).toBe("10 Feb 2026");
    expect(legacy.country("IL")).toBe("Israel");
  });
});

describe("number, currency and percent decimals", () => {
  it("whole numbers show no decimals, others exactly N", () => {
    expect(with_({}).number(12)).toBe("12");
    expect(with_({}).number(12.5)).toBe("12.50");
    expect(with_({ maxDigitsForNumbers: 3 }).number(1234.56789)).toBe("1,234.568");
    expect(with_({ maxDigitsForNumbers: 0 }).number(2.6)).toBe("3");
  });
  it("currency uses the currency digits and the code's symbol", () => {
    expect(with_({}).currency(1000, "USD")).toBe("US$1,000");
    expect(with_({ maxDigitsForCurrency: 1 }).currency(3.33333, "EUR")).toBe("€3.3");
  });
  it("a bad currency code degrades to code and number", () => {
    expect(with_({}).currency(5.5, "dollars")).toBe("dollars 5.50");
  });
  it("percent values are whole percents with their own digits", () => {
    expect(with_({}).percent(18)).toBe("18%");
    expect(with_({ maxDigitsForPercent: 1 }).percent(18.456)).toBe("18.5%");
  });
  it("a value that rounds to zero is not negative", () => {
    expect(with_({}).number(-0.001)).toBe("0.00");
  });
});

describe("dates", () => {
  const cases: [FormattingSettings["dateFormat"], string][] = [
    ["DD.MM.YY", "10.02.26"],
    ["DD.MM.YYYY", "10.02.2026"],
    ["YY.MM.DD", "26.02.10"],
    ["YYYY.MM.DD", "2026.02.10"],
    ["DD MMM YYYY", "10 Feb 2026"],
    ["MMM DD, YYYY", "Feb 10, 2026"],
  ];
  it.each(cases)("%s", (dateFormat, expected) => expect(with_({ dateFormat }).date(DATE)).toBe(expected));
  it("the delimiter replaces the dots", () => {
    expect(with_({ dateDelimiter: "/" }).date(DATE)).toBe("10/02/2026");
    expect(with_({ dateDelimiter: "-", dateFormat: "YYYY.MM.DD" }).date(DATE)).toBe("2026-02-10");
  });
  it("month-name formats ignore the delimiter", () => {
    expect(with_({ dateDelimiter: "/", dateFormat: "DD MMM YYYY" }).date(DATE)).toBe("10 Feb 2026");
  });
  it("an invalid date shows the placeholder", () => expect(with_({}).date("not a date")).toBe("--"));
  it("month names follow the language", () => {
    expect(createFormatters("he", { ...DEFAULT_FORMATTING, dateFormat: "DD MMM YYYY" }).date(DATE)).toContain("פבר");
  });
});

describe("times and date-time structure", () => {
  it("24-hour, 12-hour and padded 12-hour", () => {
    expect(with_({}).dateTime(DATE_TIME)).toBe("10.02.2026 14:05");
    expect(with_({ timeFormat: "h:mm A" }).dateTime(MORNING)).toBe("10.02.2026 9:05 am");
    expect(with_({ timeFormat: "hh:mm A" }).dateTime(MORNING)).toBe("10.02.2026 09:05 am");
    expect(with_({ timeFormat: "h:mm A" }).dateTime(DATE_TIME)).toBe("10.02.2026 2:05 pm");
  });
  it("orders and joins date and time", () => {
    expect(with_({ datetimeStructure: "date_time_comma" }).dateTime(DATE_TIME)).toBe("10.02.2026, 14:05");
    expect(with_({ datetimeStructure: "time_date_space" }).dateTime(DATE_TIME)).toBe("14:05 10.02.2026");
    expect(with_({ datetimeStructure: "time_date_comma" }).dateTime(DATE_TIME)).toBe("14:05, 10.02.2026");
  });
  it("accepts a space between date and time", () => {
    expect(with_({}).dateTime("2026-02-10 14:05")).toBe("10.02.2026 14:05");
  });
});
