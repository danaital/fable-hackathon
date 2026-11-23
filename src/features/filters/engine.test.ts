import { describe, expect, it } from "vitest";
import type { CellValue, FieldDef, Row } from "@/data/types";
import type { FilterRelation } from "@/features/report/viewState";
import { LATEST } from "@/features/currency/codes";
import { rateKey } from "@/features/currency/convert";
import { DEFAULT_CURRENCY } from "@/features/settings/schema";
import { convertFilterAmount, countUnconverted, filterRateRequests, type FilterRates } from "./currency";
import { applyFilters, effectiveRelation, type FilterSpec } from "./engine";

// Monday 23 November 2026, 15:30:45 local time.
const NOW = new Date(2026, 10, 23, 15, 30, 45);
const at = (...parts: [number, number, number, number, number, number]) => new Date(...parts).toISOString();

const fields: FieldDef[] = [
  { key: "name", type: "string", labelKey: "field.name" },
  { key: "status", type: "status", labelKey: "field.status" },
  { key: "amount", type: "currency", labelKey: "field.amount", currencyKey: "currency" },
  { key: "items", type: "number", labelKey: "field.items" },
  { key: "orderDate", type: "date", labelKey: "field.orderDate" },
  { key: "deliveryDate", type: "date", labelKey: "field.deliveryDate" },
  { key: "paidAt", type: "datetime", labelKey: "field.paidAt" },
  { key: "express", type: "boolean", labelKey: "field.express" },
  { key: "tags", type: "string", labelKey: "field.channel" },
];

const rows: Row[] = [
  { id: 1, name: "Cedar Studio", status: "late", amount: 100, currency: "USD", items: 1, orderDate: "2026-11-23", deliveryDate: "2026-11-25", paidAt: at(2026, 10, 23, 10, 0, 0), express: true, tags: "vip, new" },
  { id: 2, name: "harbor books", status: "delivered", amount: 250.5, currency: "EUR", items: 5, orderDate: "2026-11-17", deliveryDate: "2026-11-17", paidAt: at(2026, 10, 17, 23, 59, 59), express: false, tags: "vip" },
  { id: 3, name: "Atlas Labs", status: "cancelled", amount: null, currency: "ILS", items: 0, orderDate: "2026-10-01", deliveryDate: null, paidAt: null, express: null, tags: null },
  { id: 4, name: "", status: "late", amount: 999, currency: "USD", items: 12, orderDate: "2025-11-20", deliveryDate: "2025-11-19", paidAt: at(2025, 10, 20, 8, 0, 0), express: true, tags: "new" },
];

let nextId = 0;
const rule = (field: string, operator: string, values: CellValue[] = [], extra: Partial<FilterSpec> = {}): FilterSpec => ({
  id: `r${(nextId += 1)}`,
  field,
  operator,
  values,
  ...extra,
});

interface RunOptions {
  relation?: FilterRelation;
  rates?: FilterRates | null;
}
const ids = (filters: FilterSpec[], { relation = "and", rates }: RunOptions = {}) =>
  applyFilters({ rows, filters, relation, fields, now: NOW, rates }).map((row) => row.id);

describe("text operators", () => {
  it("match without regard to case", () => {
    expect(ids([rule("name", "contains", ["BOOK"])])).toEqual([2]);
    expect(ids([rule("name", "startsWith", ["cedar"])])).toEqual([1, 4]);
    expect(ids([rule("name", "endsWith", ["labs"])])).toEqual([3, 4]);
    expect(ids([rule("name", "notEquals", ["atlas labs"])])).toEqual([1, 2, 4]);
  });

  it("keep empty cells by default, except for contains", () => {
    expect(ids([rule("name", "equals", ["Atlas Labs"])])).toEqual([3, 4]);
    expect(ids([rule("name", "contains", ["atlas"])])).toEqual([3]);
    expect(ids([rule("name", "notContains", ["atlas"])])).toEqual([1, 2, 4]);
  });

  it("treat a blank value as no constraint, and 0 as a real value", () => {
    expect(ids([rule("name", "contains", ["  "])])).toEqual([1, 2, 3, 4]);
    expect(ids([rule("name", "equals", [])])).toEqual([1, 2, 3, 4]);
    expect(ids([rule("items", "equals", [0])])).toEqual([3]);
  });

  it("match lists for in and notIn", () => {
    expect(ids([rule("status", "in", ["LATE", "cancelled"])])).toEqual([1, 3, 4]);
    expect(ids([rule("status", "notIn", ["late"])])).toEqual([2, 3]);
    expect(ids([rule("status", "in", [])])).toEqual([1, 2, 3, 4]);
  });

});

describe("number operators", () => {
  it("compare as numbers", () => {
    expect(ids([rule("items", "equals", ["5.0"])])).toEqual([2]);
    expect(ids([rule("items", "greaterThan", [1])])).toEqual([2, 4]);
    expect(ids([rule("items", "lessThanOrEqual", [1])])).toEqual([1, 3]);
    expect(ids([rule("items", "notEquals", [1])])).toEqual([2, 3, 4]);
  });

  it("treat between as inclusive, and one bound as an open range", () => {
    expect(ids([rule("items", "between", [1, 5])])).toEqual([1, 2]);
    expect(ids([rule("items", "between", [5, null])])).toEqual([2, 4]);
    expect(ids([rule("items", "between", [null, 1])])).toEqual([1, 3]);
    expect(ids([rule("items", "between", [null, null])])).toEqual([1, 2, 3, 4]);
  });

  it("keep rows with no amount unless empty values are excluded", () => {
    expect(ids([rule("amount", "greaterThan", [200])])).toEqual([2, 3, 4]);
    expect(ids([rule("amount", "greaterThan", [200], { includeNoValues: false })])).toEqual([2, 4]);
    expect(ids([rule("amount", "equals", [], { includeNoValues: false })])).toEqual([1, 2, 4]);
  });
});

describe("empty and yes/no rules", () => {
  it("find empty and filled cells", () => {
    expect(ids([rule("deliveryDate", "isNull", [true])])).toEqual([3]);
    expect(ids([rule("deliveryDate", "isNull", [false])])).toEqual([1, 2, 4]);
    expect(ids([rule("deliveryDate", "isNotNull", [true])])).toEqual([1, 2, 4]);
    expect(ids([rule("name", "isNull", [])])).toEqual([4]);
  });

  it("drop empty cells for a yes/no comparison", () => {
    expect(ids([rule("express", "equals", [true])])).toEqual([1, 4]);
    expect(ids([rule("express", "equals", ["false"])])).toEqual([2]);
    expect(ids([rule("express", "notEquals", [true])])).toEqual([2]);
  });
});

describe("date operators", () => {
  it("compare dates by calendar day", () => {
    expect(ids([rule("orderDate", "equals", ["2026-11-17"])])).toEqual([2]);
    expect(ids([rule("orderDate", "greaterThanOrEqual", ["2026-11-17"])])).toEqual([1, 2]);
    expect(ids([rule("orderDate", "between", ["2026-10-01", "2026-11-17"])])).toEqual([2, 3]);
    expect(ids([rule("orderDate", "notBetween", ["2026-10-01", "2026-11-17"])])).toEqual([1, 4]);
    expect(ids([rule("orderDate", "between", ["2026-11-01", null])])).toEqual([1, 2]);
  });

  it("compare date-times by instant, with a day-only bound covering the whole day", () => {
    expect(ids([rule("paidAt", "between", ["2026-11-17", "2026-11-17"])])).toEqual([2, 3]);
    expect(ids([rule("paidAt", "between", ["2026-11-17T00:00", "2026-11-17T23:00"])])).toEqual([3]);
    expect(ids([rule("paidAt", "greaterThan", ["2026-11-23T09:59:59"])])).toEqual([1, 3]);
    expect(ids([rule("paidAt", "equals", ["2026-11-23T10:00:00"])])).toEqual([1, 3]);
  });
});

describe("preset periods", () => {
  it("resolve against now each time", () => {
    expect(ids([rule("orderDate", "between", [], { period: "last_7_days" })])).toEqual([1, 2]);
    expect(ids([rule("orderDate", "between", [], { period: "last_month" })])).toEqual([3]);
    expect(ids([rule("orderDate", "notBetween", [], { period: "this_year" })])).toEqual([4]);
    expect(ids([rule("orderDate", "between", [], { period: "today_and_after" })])).toEqual([1]);
    expect(ids([rule("paidAt", "between", [], { period: "before_now", includeNoValues: false })])).toEqual([1, 2, 4]);
    expect(ids([rule("paidAt", "between", [], { period: "today_morning", includeNoValues: false })])).toEqual([1]);
  });

  it("win over stored dates, which may be stale", () => {
    expect(ids([rule("orderDate", "between", ["2020-01-01", "2020-01-31"], { period: "today" })])).toEqual([1]);
  });

  it("are ignored on an operator that is not a range", () => {
    expect(ids([rule("orderDate", "equals", ["2026-11-17"], { period: "today" })])).toEqual([2]);
  });
});

describe("relation", () => {
  const late = () => rule("status", "equals", ["late"]);
  const big = () => rule("items", "greaterThan", [4]);
  const thisYear = () => rule("orderDate", "between", [], { period: "this_year" });

  it("AND needs every filter, OR needs one", () => {
    expect(ids([late(), big()])).toEqual([4]);
    expect(ids([late(), big()], { relation: "or" })).toEqual([1, 2, 4]);
  });

  it("FLEX needs every mandatory filter and at least one of the others", () => {
    const filters = [{ ...thisYear(), mandatory: true }, late(), big()];
    expect(ids(filters, { relation: "flex" })).toEqual([1, 2]);
  });

  it("FLEX with no mandatory filter behaves as OR, and with only mandatory filters as AND", () => {
    expect(ids([thisYear(), late(), big()], { relation: "flex" })).toEqual([1, 2, 3, 4]);
    const all = [thisYear(), late(), big()].map((filter) => ({ ...filter, mandatory: true }));
    expect(ids(all, { relation: "flex" })).toEqual([]);
  });

  it("FLEX with fewer than three filters becomes AND with a mandatory filter, otherwise OR", () => {
    expect(ids([{ ...late(), mandatory: true }, big()], { relation: "flex" })).toEqual([4]);
    expect(ids([late(), big()], { relation: "flex" })).toEqual([1, 2, 4]);
    expect(effectiveRelation([{ ...late(), mandatory: true }, big()], "flex")).toBe("and");
    expect(effectiveRelation([late(), big()], "flex")).toBe("or");
    expect(effectiveRelation([late(), big(), thisYear()], "flex")).toBe("flex");
  });

  it("counts only filters that are switched on", () => {
    const off = { ...thisYear(), enabled: false };
    expect(effectiveRelation([late(), big(), off], "flex")).toBe("or");
    expect(ids([late(), { ...big(), enabled: false }])).toEqual([1, 4]);
  });

  it("still counts a blank filter towards the three FLEX needs", () => {
    const filters = [{ ...thisYear(), mandatory: true }, late(), rule("name", "contains", [])];
    expect(effectiveRelation(filters, "flex")).toBe("flex");
    expect(ids(filters, { relation: "flex" })).toEqual([1]);
  });
});

describe("field-to-field rules", () => {
  const compare = (fieldOperator: string, extra: Partial<FilterSpec> = {}) =>
    rule("deliveryDate", "equals", [], { compareField: "orderDate", fieldOperator, ...extra });

  it("use a yes/no result as the verdict, keeping rows where a side is empty", () => {
    expect(ids([compare("fieldLessThan")])).toEqual([3, 4]);
    expect(ids([compare("fieldLessThan", { includeNoValues: false })])).toEqual([4]);
    expect(ids([compare("fieldEquals", { values: [false] })])).toEqual([1, 3, 4]);
  });

  it("subtract dates in days and test the result", () => {
    expect(ids([compare("fieldSubtract", { operator: "greaterThan", values: [1] })])).toEqual([1, 3]);
    expect(ids([compare("fieldSubtract", { operator: "between", values: [-1, 0], includeNoValues: false })])).toEqual([2, 4]);
    expect(ids([compare("fieldSubtract", { operator: "greaterThan" })])).toEqual([1, 2, 3, 4]);
  });

  it("compare a date with a date-time by calendar day", () => {
    const sameDay = rule("orderDate", "equals", [], { compareField: "paidAt", fieldOperator: "fieldEquals", includeNoValues: false });
    expect(ids([sameDay])).toEqual([1, 2, 4]);
  });

  it("never match an impossible calculation", () => {
    const divide = rule("amount", "greaterThanOrEqual", [0], { compareField: "items", fieldOperator: "fieldDivide", includeNoValues: false });
    expect(ids([divide])).toEqual([1, 2, 4]);
    const byZero = rule("items", "notEquals", [5], { compareField: "items", fieldOperator: "fieldDivide" });
    expect(ids([byZero])).toEqual([1, 2, 4]);
  });

  it("ignore an incomplete rule instead of hiding rows", () => {
    expect(ids([rule("deliveryDate", "equals", [], { compareField: "orderDate" })])).toEqual([1, 2, 3, 4]);
    expect(ids([rule("deliveryDate", "equals", [], { compareField: "missing", fieldOperator: "fieldEquals" })])).toEqual([1, 2, 3, 4]);
  });
});

describe("rules that cannot be applied as stored", () => {
  it("fall back to the type's default operator when the operator is not supported", () => {
    expect(ids([rule("name", "greaterThan", ["cedar"])])).toEqual([1]);
    expect(ids([rule("items", "contains", [5])])).toEqual([2]);
  });

  it("skip a rule whose field is unknown", () => {
    expect(ids([rule("nope", "equals", ["x"])])).toEqual([1, 2, 3, 4]);
  });
});

describe("amount filters typed in their own currency", () => {
  // One euro buys two US dollars or eight shekels.
  const EUR_RATES = { USD: 2, ILS: 8 };
  const rates: FilterRates = { table: new Map([[rateKey("EUR", LATEST), { date: "2026-11-20", rates: EUR_RATES }]]), dateFor: () => LATEST };
  const over100Eur = () => rule("amount", "greaterThan", [100], { currency: { targetCurrency: "EUR" } });

  it("convert an amount through the base currency", () => {
    expect(convertFilterAmount({ amount: 100, from: "EUR", to: "USD", date: LATEST, rates })).toBe(200);
    expect(convertFilterAmount({ amount: 100, from: "EUR", to: "EUR", date: null, rates })).toBe(100);
    expect(convertFilterAmount({ amount: 100, from: "EUR", to: "GBP", date: LATEST, rates })).toBeNull();
    expect(convertFilterAmount({ amount: 100, from: "EUR", to: "USD", date: null, rates })).toBeNull();
  });

  it("compare each row in its own currency", () => {
    // 100 EUR is 200 USD: the 100 USD row fails, the 999 USD and 250.5 EUR rows pass, the empty amount is kept.
    expect(ids([over100Eur()], { rates })).toEqual([2, 3, 4]);
    expect(ids([rule("amount", "between", [40, 60], { currency: { targetCurrency: "EUR" }, includeNoValues: false })], { rates })).toEqual([1]);
  });

  it("use the rate of each row's own date", () => {
    const dated: FilterRates = {
      table: new Map([
        [rateKey("EUR", "2026-11-23"), { date: "2026-11-23", rates: { USD: 0.5 } }],
        [rateKey("EUR", "2025-11-20"), { date: "2025-11-20", rates: { USD: 20 } }],
      ]),
      dateFor: (row) => String(row.orderDate),
    };
    // 100 EUR is 50 USD on the first row's day (100 USD passes) and 2,000 USD on the last row's day (999 USD fails).
    expect(ids([over100Eur()], { rates: dated })).toEqual([1, 2, 3]);
  });

  it("keep a row whose rate is unknown", () => {
    const noUsd: FilterRates = { table: new Map([[rateKey("EUR", LATEST), { date: "2026-11-20", rates: { ILS: 8 } }]]), dateFor: () => LATEST };
    expect(ids([over100Eur()], { rates: noUsd })).toEqual([1, 2, 3, 4]);
    expect(countUnconverted({ rows, field: fields[2], currency: "EUR", rates: noUsd })).toBe(2);
    expect(countUnconverted({ rows, field: fields[2], currency: "EUR", rates })).toBe(0);
  });

  it("do not filter while rates are loading", () => {
    expect(ids([over100Eur()], { rates: null })).toEqual([1, 2, 3, 4]);
    expect(ids([over100Eur()])).toEqual([1, 2, 3, 4]);
  });

  it("ask for one rate per filter currency and rate day, and none for rows already in that currency", () => {
    const requests = filterRateRequests({ rows, fields, filters: [over100Eur(), rule("amount", "equals", [5])], currency: DEFAULT_CURRENCY, now: NOW });
    expect(requests).toHaveLength(1);
    expect(requests[0].base).toBe("EUR");
    expect(filterRateRequests({ rows, fields, filters: [rule("amount", "equals", [5])], currency: DEFAULT_CURRENCY, now: NOW })).toEqual([]);
  });

  it("compare stored amounts when the filter has no currency of its own", () => {
    expect(ids([rule("amount", "greaterThan", [100])], { rates })).toEqual([2, 3, 4]);
  });
});
