import { createElement as h } from "react";
import { renderToString } from "react-dom/server";
import { ThemeProvider } from "styled-components";
import { describe, expect, it } from "vitest";
import { getReport, getRows } from "@/data/reports";
import { CurrencyProvider } from "@/features/currency/CurrencyProvider";
import { ReportProvider } from "@/features/report/ReportContext";
import { I18nProvider } from "@/i18n";
import { lightTheme } from "@/styles/theme";
import { DataGrid } from "./DataGrid";
import { ColumnsButton, GroupingToolbar } from "./controls";

describe("grid smoke render", () => {
  it.each(["en", "he"] as const)("renders the orders grid and its controls in %s without throwing", (locale) => {
    const report = getReport("orders");
    const rows = getRows("orders") ?? [];
    if (!report) throw new Error("orders report missing");
    const grid = [h(ColumnsButton, { key: "columns" }), h(GroupingToolbar, { key: "grouping" }), h(DataGrid, { key: "grid" })];
    const inReport = h(ReportProvider, { report, rows, children: grid });
    const withCurrency = h(CurrencyProvider, { report, rows, children: inReport });
    const html = renderToString(h(ThemeProvider, { theme: lightTheme }, h(I18nProvider, { initialLocale: locale, children: withCurrency })));
    expect(html).toContain("<table");
    expect(html).toContain("</tfoot>");
    expect(html.match(/<tr/g)?.length).toBeGreaterThan(25);
  });
});
