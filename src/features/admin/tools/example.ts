import type { SummaryConfigInput } from "@/features/summary/config";

// A small file an admin can download and import straight back, to see the whole import flow on the orders report.
// Checked by configStore.test.ts, so it cannot drift from the import rules.

export const EXAMPLE_REPORT_ID = "orders";
export const EXAMPLE_FILE_NAME = "orders-example-config.json";

const example: SummaryConfigInput = {
  widgets: [
    {
      id: "example_cancelled_orders",
      type: "basicCalculation",
      calculation: "count",
      tone: "danger",
      filters: [{ field: "status", values: ["cancelled"] }],
      drill: { filters: [{ field: "status", values: ["cancelled"] }] },
      title: { en: "Cancelled orders", he: "הזמנות שבוטלו" },
      subtitle: { en: "Imported from the example file", he: "יובא מקובץ הדוגמה" },
    },
    {
      id: "example_top_countries",
      type: "ranking",
      labelField: "country",
      topN: 3,
      showShare: true,
      title: { en: "Top {topN} countries by orders", he: "{topN} המדינות המובילות לפי הזמנות" },
    },
  ],
  charts: [
    {
      id: "example_orders_by_agent",
      type: "horizontalBar",
      dataField: "agent",
      limit: 8,
      showOther: true,
      title: { en: "Orders by agent", he: "הזמנות לפי נציג" },
    },
  ],
};

/** A whole-report file with two sections only: sections left out of a file are left alone by the import. */
export const EXAMPLE_IMPORT = { reportName: EXAMPLE_REPORT_ID, ...example };
