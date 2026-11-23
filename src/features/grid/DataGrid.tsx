"use client";

import { useCallback, useMemo, useState } from "react";
import { Notice, Stack, Text, VisuallyHidden } from "@/components/ui";
import type { FieldDef, Row } from "@/data/types";
import { useReport } from "@/features/report/ReportContext";
import { DEFAULT_PAGE_SIZE } from "@/features/report/viewState";
import { useEffectiveSettings } from "@/features/settings/store";
import { useI18n, type I18nKey } from "@/i18n";
import { GridTable, type TableShared } from "./GridTable";
import { GroupedGrid } from "./GroupedGrid";
import { TableOptions } from "./TableOptions";
import { cellText } from "./cells";
import { toDraft } from "./columns";
import { ColumnsButton } from "./controls";
import { useGridPrefs } from "./gridPrefs";
import { ALL_PAGE_SIZE } from "./paging";
import { prepareRows } from "./prepare";
import { nextSortRules, type LabelFor, type SortDirection } from "./sort";
import { defaultTotals, isAggregate, totalKinds, type TotalKind } from "./totals";
import { useColumnsPreview } from "./uiStore";

const EMPTY_ROW: Row = {};
const SORT_ANNOUNCE: Record<SortDirection, I18nKey> = { asc: "gridx.sort.announce.asc", desc: "gridx.sort.announce.desc" };
const without = <T,>(record: Readonly<Record<string, T>>, key: string): Record<string, T> =>
  Object.fromEntries(Object.entries(record).filter(([name]) => name !== key));

/**
 * The report's rows as a table, or as one table per group when the view groups.
 * Reads filtered rows, sorting, columns, grouping, totals and page size from the report view.
 * The search box, filters and the manage-columns button live in the data toolbar above it.
 */
export function DataGrid() {
  const { t, tData } = useI18n();
  const { report, name, rows, filteredRows, view, setView, format } = useReport();
  const [prefs, setPrefs] = useGridPrefs(report.id);
  // Totals position, the pinned header and the minimum search length are user settings, with per-report overrides.
  const { summaryRowLocation, isTableHeaderPinned, minSearch } = useEffectiveSettings(report.id).customization;
  const preview = useColumnsPreview(report.id);
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState("");
  // "All" does not survive a new filter result of more than one default page; it comes back when the user picks it again.
  const [allDropped, setAllDropped] = useState(false);
  const [seen, setSeen] = useState({ filters: view.filters, relation: view.relation, search: view.search, sorts: view.sorts });

  // Any change to filters, search or sort returns to the first page.
  const filterChanged = seen.filters !== view.filters || seen.relation !== view.relation || seen.search !== view.search;
  if (filterChanged || seen.sorts !== view.sorts) {
    setSeen({ filters: view.filters, relation: view.relation, search: view.search, sorts: view.sorts });
    setPage(0);
    if (filterChanged) setAllDropped(view.pageSize >= ALL_PAGE_SIZE && filteredRows.length > DEFAULT_PAGE_SIZE);
  }

  // Cells mark the search term only once it is long enough to count as a search.
  const search = view.search.trim().length >= minSearch ? view.search : "";
  const cell = useMemo(() => ({ format, t, tData, search }), [format, t, tData, search]);
  const labelFor = useCallback<LabelFor>((field, value) => cellText(value, { field, row: EMPTY_ROW, format, t, tData }), [format, t, tData]);
  // While the columns panel is open the grid shows its draft, so a change can be seen before it is applied.
  const columns = preview?.columns ?? view.columns;
  const fields = useMemo(
    () => toDraft(report.fields, columns).visible.flatMap((key) => report.fields.find((field) => field.key === key) ?? []),
    [report.fields, columns],
  );
  const prepared = useMemo(
    () => prepareRows({ rows: filteredRows, view: { sorts: view.sorts, groupBy: view.groupBy }, fields: report.fields, groupOrder: prefs.groupOrder, labelFor }),
    [filteredRows, view.sorts, view.groupBy, report.fields, prefs.groupOrder, labelFor],
  );
  const groupFields = useMemo(
    () => view.groupBy.flatMap((key) => report.fields.find((field) => field.key === key) ?? []),
    [view.groupBy, report.fields],
  );
  // Until the user picks totals for this report (or a view brings its own), the default totals show.
  const usesDefaultTotals = !prefs.totalsCustomized && Object.keys(view.totals).length === 0;
  const baseTotals = useMemo(() => (usesDefaultTotals ? defaultTotals(report.fields) : view.totals), [usesDefaultTotals, report.fields, view.totals]);
  const kinds = useMemo(() => totalKinds({ fields, totals: baseTotals, extra: prefs.extraTotals }), [fields, baseTotals, prefs.extraTotals]);

  const onSort = useCallback(
    (key: string) => {
      const next = nextSortRules(view.sorts, key);
      const rule = next.find((candidate) => candidate.key === key);
      const field = report.fields.find((candidate) => candidate.key === key);
      setView({ sorts: next });
      if (field) setStatus(t(rule ? SORT_ANNOUNCE[rule.direction] : "gridx.sort.announce.removed", { column: t(field.labelKey) }));
    },
    [view.sorts, report.fields, setView, t],
  );
  const onToggleGroup = useCallback(
    (key: string) =>
      setView((current) => ({
        ...current,
        groupBy: current.groupBy.includes(key) ? current.groupBy.filter((existing) => existing !== key) : [...current.groupBy, key],
      })),
    [setView],
  );
  const onPageSize = useCallback(
    (pageSize: number) => {
      setAllDropped(false);
      setView({ pageSize });
    },
    [setView],
  );
  // A calculation the shared Aggregate type can name goes into view.totals; the others stay in the grid's preferences.
  const onKind = (field: FieldDef, kind: TotalKind | null) => {
    const shared = kind !== null && isAggregate(kind) ? kind : null;
    // The first choice writes the defaults in force into the view, so the other columns keep their totals.
    setView((current) => ({ ...current, totals: shared ? { ...baseTotals, [field.key]: shared } : without(baseTotals, field.key) }));
    setPrefs({
      totalsCustomized: true,
      extraTotals: kind !== null && !isAggregate(kind) ? { ...prefs.extraTotals, [field.key]: kind } : without(prefs.extraTotals, field.key),
    });
  };

  const pageSize = allDropped && view.pageSize >= ALL_PAGE_SIZE ? DEFAULT_PAGE_SIZE : view.pageSize;
  const emptyText = t(rows.length === 0 ? "gridx.noData" : "gridx.noResults");
  const shared = useMemo<TableShared>(
    () => ({
      fields,
      sorts: view.sorts,
      onSort,
      groupBy: view.groupBy,
      onToggleGroup,
      kinds,
      totalsPosition: summaryRowLocation,
      pinHeader: isTableHeaderPinned,
      highlight: preview?.highlight ?? null,
      pageSize,
      onPageSize,
      cell,
      emptyText,
    }),
    [fields, view.sorts, onSort, view.groupBy, onToggleGroup, kinds, summaryRowLocation, isTableHeaderPinned, preview?.highlight, pageSize, onPageSize, cell, emptyText],
  );

  if (fields.length === 0) {
    return (
      <Notice role="status">
        <Text>{t("gridx.noColumns")}</Text>
        <ColumnsButton />
      </Notice>
    );
  }

  return (
    <Stack $gap="md">
      <Stack $row $wrap $justify="space-between" $gap="sm">
        <Text $muted $size="sm" role="status">
          {t("grid.rows", { count: format.number(filteredRows.length) })}
        </Text>
        <TableOptions
          fields={fields}
          sorts={view.sorts}
          onSort={onSort}
          onClearSorts={() => setView({ sorts: [] })}
          kinds={kinds}
          onKind={onKind}
          totalsHidden={summaryRowLocation === "none"}
        />
      </Stack>
      <VisuallyHidden role="status">{status}</VisuallyHidden>
      <Text $muted $size="xs">
        {t("gridx.sort.hint")}
      </Text>
      {prepared.groups && prepared.groups.length > 0 ? (
        <GroupedGrid
          shared={shared}
          groups={prepared.groups}
          groupFields={groupFields}
          allFields={report.fields}
          order={prefs.groupOrder}
          onOrder={(groupOrder) => setPrefs({ groupOrder })}
        />
      ) : (
        <GridTable shared={shared} caption={t("grid.caption", { name })} rows={prepared.rows} page={page} onPage={setPage} />
      )}
    </Stack>
  );
}
