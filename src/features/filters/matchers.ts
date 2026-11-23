import type { CellValue, Row } from "@/data/types";
import { convertFilterAmount, type FilterRates } from "./currency";
import { isBlank, VALUE_SHAPE, type Operator, type ValueKind } from "./operators";
import { dayPoint, instantPoint, lower, toBool, toNumber, type Point } from "./values";

/** Tests one non-empty cell against a rule's values. Empty cells are decided before a test runs. */
export type CellTest = (cell: CellValue, row: Row) => boolean;

export const PASS: CellTest = () => true;

const COMPARE: Partial<Record<Operator, (cell: number, target: number) => boolean>> = {
  equals: (cell, target) => cell === target,
  notEquals: (cell, target) => cell !== target,
  greaterThan: (cell, target) => cell > target,
  greaterThanOrEqual: (cell, target) => cell >= target,
  lessThan: (cell, target) => cell < target,
  lessThanOrEqual: (cell, target) => cell <= target,
};

const TEXT: Partial<Record<Operator, (cell: string, value: string) => boolean>> = {
  equals: (cell, value) => cell === value,
  notEquals: (cell, value) => cell !== value,
  contains: (cell, value) => cell.includes(value),
  notContains: (cell, value) => !cell.includes(value),
  startsWith: (cell, value) => cell.startsWith(value),
  endsWith: (cell, value) => cell.endsWith(value),
};

const listKey = (value: CellValue) => String(value).trim().toLowerCase();

interface OrderedTestInput {
  operator: Operator;
  /** Turns a cell into a comparable number; `NaN` when it cannot be read. */
  cellPoint: Point;
  /** One target, or [from, to]. `NaN` marks a bound that is blank or unreadable. */
  bounds: readonly number[];
}

/** Numbers, days and instants all compare as numbers. A blank bound does not constrain. */
function orderedTest({ operator, cellPoint, bounds }: OrderedTestInput): CellTest {
  const [first = Number.NaN, second = Number.NaN] = bounds;
  if (VALUE_SHAPE[operator] === "range") {
    const from = Number.isNaN(first) ? Number.NEGATIVE_INFINITY : first;
    const to = Number.isNaN(second) ? Number.POSITIVE_INFINITY : second;
    if (from === Number.NEGATIVE_INFINITY && to === Number.POSITIVE_INFINITY) return PASS;
    const wantInside = operator === "between";
    return (cell) => {
      const at = cellPoint(cell);
      return (!Number.isNaN(at) && at >= from && at <= to) === wantInside;
    };
  }
  const compare = COMPARE[operator];
  if (!compare || Number.isNaN(first)) return PASS;
  return (cell) => {
    const at = cellPoint(cell);
    // A cell that cannot be read fails every positive comparison and is "not equal" to anything.
    return Number.isNaN(at) ? operator === "notEquals" : compare(at, first);
  };
}

const numberTest = (operator: Operator, bounds: readonly number[]) => orderedTest({ operator, cellPoint: toNumber, bounds });

function textTest(operator: Operator, values: readonly CellValue[]): CellTest {
  const match = TEXT[operator];
  if (!match) return numberTest(operator, values.map(toNumber));
  const value = lower(values[0]);
  return (cell) => match(lower(cell), value);
}

function listTest(operator: Operator, values: readonly CellValue[]): CellTest {
  const wanted = new Set(values.filter((value) => !isBlank(value)).map(listKey));
  const wantListed = operator === "in";
  return (cell) => wanted.has(listKey(cell)) === wantListed;
}

/** When both sides look like yes/no values, equality compares them as booleans (so `1` equals `true`). */
function withBoolean(operator: Operator, value: CellValue | undefined, fallback: CellTest): CellTest {
  const wanted = toBool(value);
  if (wanted === null || (operator !== "equals" && operator !== "notEquals")) return fallback;
  return (cell, row) => {
    const actual = toBool(cell);
    return actual === null ? fallback(cell, row) : (actual === wanted) === (operator === "equals");
  };
}

interface ValueTestInput {
  kind: ValueKind;
  operator: Operator;
  values: readonly CellValue[];
}

export function valueTest({ kind, operator, values }: ValueTestInput): CellTest {
  const shape = VALUE_SHAPE[operator];
  if (shape === "list") return listTest(operator, values);
  // Dates compare by calendar day.
  if (kind === "date") return orderedTest({ operator, cellPoint: dayPoint, bounds: values.map(dayPoint) });
  // Date-times compare by instant; in a range, a bound without a time covers its whole day.
  if (kind === "datetime") {
    return orderedTest({ operator, cellPoint: instantPoint(false), bounds: [instantPoint(false)(values[0]), instantPoint(true)(values[1])] });
  }
  const base = kind === "number" ? numberTest(operator, values.map(toNumber)) : textTest(operator, values);
  return shape === "single" ? withBoolean(operator, values[0], base) : base;
}

interface ConvertedTestInput {
  operator: Operator;
  values: readonly CellValue[];
  /** The currency the filter values are typed in. */
  currency: string;
  /** Row field holding each row's currency code. */
  currencyKey: string | undefined;
  rates: FilterRates;
}

/**
 * Amount test for a filter typed in its own currency: the filter values are converted into each row's
 * currency at that row's rate date. A row whose currency or rate is unknown is kept.
 */
export function convertedTest({ operator, values, currency, currencyKey, rates }: ConvertedTestInput): CellTest {
  const amounts = values.map(toNumber);
  const byRate = new Map<string, CellTest>();
  return (cell, row) => {
    const rowCurrency = currencyKey ? row[currencyKey] : null;
    if (typeof rowCurrency !== "string" || rowCurrency === "") return true;
    const date = rates.dateFor(row);
    const key = `${rowCurrency}|${date ?? ""}`;
    let test = byRate.get(key);
    if (!test) {
      const converted = amounts.map((amount) => (Number.isNaN(amount) ? amount : convertFilterAmount({ amount, from: currency, to: rowCurrency, date, rates })));
      test = converted.includes(null) ? PASS : numberTest(operator, converted.map((amount) => amount ?? Number.NaN));
      byRate.set(key, test);
    }
    return test(cell, row);
  };
}
