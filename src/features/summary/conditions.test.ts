import { describe, expect, it } from "vitest";
import { evaluateCondition } from "./conditions";
import { summaryConfigSchema, type DisplayCondition, type SummaryConfigInput } from "./config";
import { ROWS } from "./testRows";

type ConditionInput = NonNullable<SummaryConfigInput["widgets"][number]["displayCondition"]>;

const condition = (input: ConditionInput): DisplayCondition => {
  const title = { en: "T", he: "ת" };
  const parsed = summaryConfigSchema.parse({ widgets: [{ id: "w", type: "basicCalculation", title, displayCondition: input }], charts: [] });
  return parsed.widgets[0].displayCondition ?? { relation: "and" };
};
const outcome = (input: ConditionInput, rows = ROWS) => evaluateCondition(condition(input), rows);

describe("evaluateCondition", () => {
  it("is met when there is no condition", () => expect(evaluateCondition(undefined, ROWS)).toBe("met"));

  it("needs exactly one distinct value on one of the scope fields", () => {
    expect(outcome({ requireSingleValueOn: ["status", "agent"] })).toBe("notScoped");
    expect(outcome({ requireSingleValueOn: ["status", "currency"] })).toBe("met");
    expect(outcome({ requireSingleValueOn: ["status"] }, ROWS.slice(0, 2))).toBe("met");
    expect(outcome({ requireSingleValueOn: ["status"] }, [])).toBe("notScoped");
  });

  it("compares the row count", () => {
    expect(outcome({ rules: [{ subject: "rowCount", operator: "greaterThanOrEqual", value: 5 }] })).toBe("met");
    expect(outcome({ rules: [{ subject: "rowCount", operator: "greaterThan", value: 5 }] })).toBe("notMet");
    expect(outcome({ rules: [{ subject: "rowCount", operator: "between", value: 1, valueTo: 5 }] })).toBe("met");
    expect(outcome({ rules: [{ subject: "rowCount", operator: "notBetween", value: 1, valueTo: 5 }] })).toBe("notMet");
  });

  it("aggregates a number field, then compares; no numbers fails", () => {
    expect(outcome({ rules: [{ subject: "field", field: "items", operator: "equals", value: 20 }] })).toBe("met");
    expect(outcome({ rules: [{ subject: "field", field: "items", aggregation: "average", operator: "lessThan", value: 5 }] })).toBe("notMet");
    expect(outcome({ rules: [{ subject: "field", field: "items", aggregation: "max", operator: "equals", value: 9 }] })).toBe("met");
    expect(outcome({ rules: [{ subject: "field", field: "agent", operator: "greaterThanOrEqual", value: 0 }] })).toBe("notMet");
  });

  it("tests each non-empty cell of a category, yes/no or date field", () => {
    const category = { subject: "field" as const, field: "status", valueKind: "category" as const, operator: "in" as const };
    expect(outcome({ rules: [{ ...category, values: ["late", "delivered"] }] })).toBe("met");
    expect(outcome({ rules: [{ ...category, values: ["late"] }] })).toBe("notMet");
    expect(outcome({ rules: [{ ...category, values: ["late"], match: "any" }] })).toBe("met");
    expect(outcome({ rules: [{ subject: "field", field: "express", valueKind: "boolean", operator: "equals", value: true, match: "any" }] })).toBe("met");
    expect(outcome({ rules: [{ subject: "field", field: "orderDate", valueKind: "date", operator: "between", value: "2026-10-01", valueTo: "2026-11-30" }] })).toBe("met");
    expect(outcome({ rules: [{ subject: "field", field: "orderDate", valueKind: "date", operator: "greaterThanOrEqual", value: "2026-11-01" }] })).toBe("notMet");
  });

  it("tests for empty and non-empty fields", () => {
    expect(outcome({ rules: [{ subject: "field", field: "status", operator: "isNotNull" }] })).toBe("notMet");
    expect(outcome({ rules: [{ subject: "field", field: "currency", operator: "isNotNull" }] })).toBe("met");
  });

  it("combines rules with AND by default, or with OR", () => {
    const rules = [
      { subject: "rowCount" as const, operator: "greaterThan" as const, value: 100 },
      { subject: "rowCount" as const, operator: "greaterThan" as const, value: 1 },
    ];
    expect(outcome({ rules })).toBe("notMet");
    expect(outcome({ rules, relation: "or" })).toBe("met");
  });

  it("skips a field rule that names no field", () => {
    expect(outcome({ rules: [{ subject: "field", operator: "greaterThan", value: 100 }] })).toBe("met");
  });
});
