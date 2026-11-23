import type { Row } from "@/data/types";
import { exportCell } from "./cells";
import type { ExportPlan } from "./plan";

const LABEL_SEPARATOR = " | ";

export interface RowGroup {
  /** "Status: Late | Country: Israel", for the group's header row. */
  label: string;
  /** "Status - Late | Country - Israel", before sheet-name rules are applied. */
  sheetName: string;
  rows: Row[];
}

/** Buckets rows by the raw values of the group fields, in order of first appearance. Labels use the formatted values. */
export function groupRows({ rows, grouping, env, t }: Pick<ExportPlan, "rows" | "grouping" | "env" | "t">): RowGroup[] {
  const fields = grouping?.fields ?? [];
  const groups = new Map<string, RowGroup>();
  for (const row of rows) {
    const key = JSON.stringify(fields.map((field) => row[field.key] ?? null));
    let group = groups.get(key);
    if (!group) {
      const parts = fields.map((field) => [t(field.labelKey), exportCell(field, row, env).text || t("value.empty")] as const);
      group = {
        label: parts.map(([name, value]) => `${name}: ${value}`).join(LABEL_SEPARATOR),
        sheetName: parts.map(([name, value]) => `${name} - ${value}`).join(LABEL_SEPARATOR),
        rows: [],
      };
      groups.set(key, group);
    }
    group.rows.push(row);
  }
  return [...groups.values()];
}
