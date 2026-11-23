import { describe, expect, it } from "vitest";
import { currentWindow, inWindow, previousWindow, resolvePeriod } from "./periods";

const now = new Date(2026, 10, 23, 15); // Monday 23 November 2026

describe("resolvePeriod", () => {
  it("resolves full calendar units", () => {
    expect(resolvePeriod("this_month", now)).toEqual({ start: "2026-11-01", end: "2026-11-30" });
    expect(resolvePeriod("this_quarter", now)).toEqual({ start: "2026-10-01", end: "2026-12-31" });
    expect(resolvePeriod("this_year", now)).toEqual({ start: "2026-01-01", end: "2026-12-31" });
  });
  it("resolves to-date windows up to today", () => {
    expect(resolvePeriod("month_to_date", now)).toEqual({ start: "2026-11-01", end: "2026-11-23" });
    expect(resolvePeriod("quarter_to_date", now)).toEqual({ start: "2026-10-01", end: "2026-11-23" });
  });
  it("counts today in rolling windows", () => {
    expect(resolvePeriod("last_7_days", now)).toEqual({ start: "2026-11-17", end: "2026-11-23" });
    expect(resolvePeriod("last_30_days", now)).toEqual({ start: "2026-10-25", end: "2026-11-23" });
  });
});

describe("currentWindow", () => {
  it("is the year-to-date snapshot when no period is configured", () => {
    expect(currentWindow(undefined, now)).toEqual({ start: "2026-01-01", end: "2026-11-23" });
  });
  it("lets explicit dates win over the period type", () => {
    expect(currentWindow({ type: "this_month", start: "2026-02-01", end: "2026-02-10" }, now)).toEqual({ start: "2026-02-01", end: "2026-02-10" });
  });
});

describe("previousWindow", () => {
  const previous = (type: Parameters<typeof resolvePeriod>[0], relationship: "previous_period" | "same_period_last_year", at = now) =>
    previousWindow({ current: resolvePeriod(type, at), type, previous: { relationship } });

  it("moves a full calendar unit back and snaps to that unit's end", () => {
    expect(previous("this_month", "previous_period")).toEqual({ start: "2026-10-01", end: "2026-10-31" });
    expect(previous("this_quarter", "previous_period")).toEqual({ start: "2026-07-01", end: "2026-09-30" });
    expect(previous("this_year", "previous_period")).toEqual({ start: "2025-01-01", end: "2025-12-31" });
  });
  it("keeps the partial length of a to-date window", () => {
    expect(previous("month_to_date", "previous_period")).toEqual({ start: "2026-10-01", end: "2026-10-23" });
  });
  it("never runs a to-date window past the end of the previous unit", () => {
    const march31 = new Date(2026, 2, 31);
    expect(previous("month_to_date", "previous_period", march31)).toEqual({ start: "2026-02-01", end: "2026-02-28" });
  });
  it("uses the same-length window ending the day before for rolling windows", () => {
    expect(previous("last_7_days", "previous_period")).toEqual({ start: "2026-11-10", end: "2026-11-16" });
    expect(previous("last_30_days", "previous_period")).toEqual({ start: "2026-09-25", end: "2026-10-24" });
  });
  it("defaults to the previous period", () => {
    expect(previousWindow({ current: resolvePeriod("last_7_days", now), type: "last_7_days" })).toEqual({ start: "2026-11-10", end: "2026-11-16" });
  });
  it("moves both ends back a year for the same period last year", () => {
    expect(previous("month_to_date", "same_period_last_year")).toEqual({ start: "2025-11-01", end: "2025-11-23" });
  });
  it("snaps a month-end end to the month end a year back", () => {
    const current = { start: "2025-02-01", end: "2025-02-28" };
    expect(previousWindow({ current, previous: { relationship: "same_period_last_year" } })).toEqual({ start: "2024-02-01", end: "2024-02-29" });
  });
  it("treats an explicit current range as a rolling window", () => {
    const current = { start: "2026-03-10", end: "2026-03-19" };
    expect(previousWindow({ current, previous: { relationship: "previous_period" } })).toEqual({ start: "2026-02-28", end: "2026-03-09" });
  });
  it("lets explicit previous dates win over the relationship", () => {
    const stored = { relationship: "previous_period" as const, start: "2020-01-01", end: "2020-01-31" };
    expect(previousWindow({ current: resolvePeriod("this_month", now), type: "this_month", previous: stored })).toEqual({ start: "2020-01-01", end: "2020-01-31" });
  });
});

describe("inWindow", () => {
  const window = { start: "2026-11-01", end: "2026-11-30" };
  it("includes both ends and whole days of date-times", () => {
    expect(inWindow("2026-11-01", window)).toBe(true);
    expect(inWindow("2026-11-30T23:59:59.000Z", window)).toBe(true);
    expect(inWindow("2026-12-01", window)).toBe(false);
  });
  it("leaves blank and non-date cells outside", () => {
    expect(inWindow(null, window)).toBe(false);
    expect(inWindow(20261115, window)).toBe(false);
  });
});
