import { createElement, type ReactNode } from "react";
import { jsx } from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { ThemeProvider } from "styled-components";
import { describe, expect, it } from "vitest";
import { getReport, getRows } from "@/data/reports";
import { BUILT_IN_SUMMARY } from "@/data/summary";
import type { ReportDef, Row } from "@/data/types";
import { CurrencyProvider } from "@/features/currency/CurrencyProvider";
import { ReportProvider } from "@/features/report/ReportContext";
import { I18nProvider } from "@/i18n";
import { LOCALES, type Locale } from "@/lib/prefs";
import { lightTheme } from "@/styles/theme";
import { evaluateCondition } from "./conditions";
import { useSummaryTools } from "./useSummary";
import { WidgetCard } from "./WidgetCard";
import { calculateWidget } from "./widgetCalc";
import { WidgetGrid } from "./WidgetGrid";

// Smoke test: every built-in widget card renders to markup in both languages without throwing.
// The test glob only picks up .ts files, so elements are built with the JSX runtime's own function instead of JSX syntax.

const NOW = new Date();

function Cards({ report, rows }: { report: ReportDef; rows: Row[] }) {
  const tools = useSummaryTools();
  return BUILT_IN_SUMMARY[report.id].widgets.map((widget) =>
    createElement(WidgetCard, {
      key: widget.id,
      widget,
      result: calculateWidget({ widget, rows, fields: report.fields, now: NOW }),
      outcome: evaluateCondition(widget.displayCondition, rows),
      busy: false,
      tools,
      onExplore: () => undefined,
    }),
  );
}

interface RenderInput {
  reportId: string;
  locale: Locale;
  children: (report: ReportDef, rows: Row[]) => ReactNode;
}

function render({ reportId, locale, children }: RenderInput): string {
  const report = getReport(reportId);
  const rows = getRows(reportId);
  if (!report || !rows) throw new Error(`no seeded report ${reportId}`);
  return renderToStaticMarkup(
    createElement(
      ThemeProvider,
      { theme: lightTheme },
      jsx(I18nProvider, {
        initialLocale: locale,
        // Same nesting as ReportShell: the report view converts its rows with the rates CurrencyProvider loads.
        children: jsx(CurrencyProvider, { report, rows, children: jsx(ReportProvider, { report, rows, children: children(report, rows) }) }),
      }),
    ),
  );
}

const cases = Object.keys(BUILT_IN_SUMMARY).flatMap((reportId) => LOCALES.map((locale) => [reportId, locale] as const));

describe("widget cards", () => {
  it.each(cases)("%s renders every card in %s", (reportId, locale) => {
    const html = render({ reportId, locale, children: (report, rows) => createElement(Cards, { report, rows }) });
    for (const widget of BUILT_IN_SUMMARY[reportId].widgets) {
      // The number of rows a ranking shows replaces the placeholder in its title.
      const [before, after = ""] = widget.title[locale].split("{topN}");
      expect(html).toContain(before);
      expect(html).toContain(after);
    }
    expect(html).not.toContain("{topN}");
    expect(html.match(/role="group"/g)).toHaveLength(BUILT_IN_SUMMARY[reportId].widgets.length);
  });

  it("refuses a mixed-currency total with a notice, and totals one currency", () => {
    const html = render({ reportId: "orders", locale: "en", children: (report, rows) => createElement(Cards, { report, rows }) });
    expect(html).toContain("These rows mix currencies (EUR, GBP, ILS, USD)");
    expect(html).toMatch(/US\$|\$/);
  });

  it("withholds a value whose display condition is not met", () => {
    const html = render({ reportId: "orders", locale: "en", children: (report, rows) => createElement(Cards, { report, rows }) });
    expect(html).toContain("Filter the report to a single value of Country to see this.");
  });
});

describe("WidgetGrid", () => {
  it("first paints one skeleton card per widget, with the grid marked busy", () => {
    const html = render({ reportId: "orders", locale: "he", children: () => createElement(WidgetGrid) });
    expect(html.match(/role="group"/g)).toHaveLength(BUILT_IN_SUMMARY.orders.widgets.length);
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("נתונים מרכזיים");
  });
});
