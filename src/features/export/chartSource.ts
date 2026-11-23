import type { Row } from "@/data/types";
import type { Locale } from "@/lib/prefs";

export interface ChartRow {
  category: string;
  value: number;
}

/** A chart as the export needs it: a title in both languages and its data table for a set of rows. */
export interface ExportChart {
  id: string;
  title: Record<Locale, string>;
  table: (rows: readonly Row[], locale: Locale) => ChartRow[];
}

/**
 * Adapter to the summary feature's charts.
 * Returns no charts until that feature exposes its chart list, which hides the wizard's Charts step.
 */
export function readCharts(): ExportChart[] {
  return [];
}
