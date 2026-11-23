import { describe, expect, it } from "vitest";
import { DATE_PERIODS, HOUR_PERIODS, periodBounds, type TimePeriod } from "./periods";

// Monday 23 November 2026, 15:30:45 local time.
const NOW = new Date(2026, 10, 23, 15, 30, 45, 500);

const dates = (period: TimePeriod) => periodBounds({ period, fieldType: "date", now: NOW });
const times = (period: TimePeriod) => periodBounds({ period, fieldType: "datetime", now: NOW });

describe("periodBounds on a date field", () => {
  it.each<[TimePeriod, string, string]>([
    ["today", "2026-11-23", "2026-11-23"],
    ["yesterday", "2026-11-22", "2026-11-22"],
    ["tomorrow", "2026-11-24", "2026-11-24"],
    ["this_week", "2026-11-22", "2026-11-28"],
    ["last_week", "2026-11-15", "2026-11-21"],
    ["next_week", "2026-11-29", "2026-12-05"],
    ["week_to_date", "2026-11-22", "2026-11-23"],
    ["this_month", "2026-11-01", "2026-11-30"],
    ["last_month", "2026-10-01", "2026-10-31"],
    ["next_month", "2026-12-01", "2026-12-31"],
    ["month_to_date", "2026-11-01", "2026-11-23"],
    ["this_month_last_year", "2025-11-01", "2025-11-30"],
    ["this_quarter", "2026-10-01", "2026-12-31"],
    ["last_quarter", "2026-07-01", "2026-09-30"],
    ["next_quarter", "2027-01-01", "2027-03-31"],
    ["quarter_to_date", "2026-10-01", "2026-11-23"],
    ["same_quarter_last_year", "2025-10-01", "2025-12-31"],
    ["last_quarter_last_year", "2025-07-01", "2025-09-30"],
    ["next_quarter_last_year", "2026-01-01", "2026-03-31"],
    ["q1_last_year", "2025-01-01", "2025-03-31"],
    ["q4_last_year", "2025-10-01", "2025-12-31"],
    ["this_year", "2026-01-01", "2026-12-31"],
    ["last_year", "2025-01-01", "2025-12-31"],
    ["next_year", "2027-01-01", "2027-12-31"],
    ["year_to_date", "2026-01-01", "2026-11-23"],
    ["last_2_days_exact", "2026-11-21", "2026-11-23"],
    ["last_3_days_exact", "2026-11-20", "2026-11-23"],
    ["last_3_days", "2026-11-21", "2026-11-23"],
    ["last_7_days", "2026-11-17", "2026-11-23"],
    ["last_30_days", "2026-10-25", "2026-11-23"],
    ["last_90_days", "2026-08-26", "2026-11-23"],
    ["last_365_days", "2025-11-24", "2026-11-23"],
    ["next_7_days", "2026-11-24", "2026-11-30"],
    ["next_30_days", "2026-11-24", "2026-12-23"],
    ["last_24_hours", "2026-11-22", "2026-11-23"],
    ["next_24_hours", "2026-11-23", "2026-11-24"],
    ["next_72_hours", "2026-11-23", "2026-11-26"],
  ])("%s", (period, from, to) => {
    expect(dates(period)).toEqual([from, to]);
  });

  it("handles a quarter that crosses the year start", () => {
    const january = new Date(2026, 0, 15, 9);
    expect(periodBounds({ period: "last_quarter", fieldType: "date", now: january })).toEqual(["2025-10-01", "2025-12-31"]);
    expect(periodBounds({ period: "last_quarter_last_year", fieldType: "date", now: january })).toEqual(["2024-10-01", "2024-12-31"]);
  });
});

describe("periodBounds on a date-time field", () => {
  it("gives whole days for date periods", () => {
    expect(times("last_7_days")).toEqual(["2026-11-17T00:00:00", "2026-11-23T23:59:59"]);
  });

  it.each<[TimePeriod, string, string]>([
    ["last_2_days_exact", "2026-11-21T15:30:45", "2026-11-23T15:30:45"],
    ["last_24_hours", "2026-11-22T15:30:45", "2026-11-23T15:30:45"],
    ["next_72_hours", "2026-11-23T15:30:45", "2026-11-26T15:30:45"],
    ["this_hour", "2026-11-23T15:00:00", "2026-11-23T15:59:59"],
    ["last_hour", "2026-11-23T14:00:00", "2026-11-23T14:59:59"],
    ["next_hour", "2026-11-23T16:00:00", "2026-11-23T16:59:59"],
    ["last_4_hours", "2026-11-23T11:30:45", "2026-11-23T15:30:45"],
    ["next_12_hours", "2026-11-23T15:30:45", "2026-11-24T03:30:45"],
    ["last_2_hours_rounded", "2026-11-23T13:00:00", "2026-11-23T15:00:00"],
    ["today_morning", "2026-11-23T00:00:00", "2026-11-23T11:59:59"],
    ["today_afternoon", "2026-11-23T12:00:00", "2026-11-23T17:59:59"],
    ["today_evening", "2026-11-23T18:00:00", "2026-11-23T23:59:59"],
  ])("%s is exact to the second", (period, from, to) => {
    expect(times(period)).toEqual([from, to]);
  });
});

describe("periodBounds", () => {
  it("leaves open-ended periods open instead of using far-away dates", () => {
    expect(dates("today_and_after")).toEqual(["2026-11-23", null]);
    expect(dates("before_and_including_today")).toEqual([null, "2026-11-23"]);
    expect(times("now_and_after")).toEqual(["2026-11-23T15:30:45", null]);
    expect(times("before_now")).toEqual([null, "2026-11-23T15:30:45"]);
  });

  it("resolves every listed period", () => {
    for (const period of [...DATE_PERIODS, ...HOUR_PERIODS]) expect(times(period)).not.toBeNull();
  });

  it("returns null for a custom, missing or unknown period", () => {
    for (const period of ["custom", undefined, "someday"]) {
      expect(periodBounds({ period, fieldType: "date", now: NOW })).toBeNull();
    }
  });
});
