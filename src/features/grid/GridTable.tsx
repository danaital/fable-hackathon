"use client";

import { memo, useMemo } from "react";
import { Caption, Stack, Tbody, Thead, Tr } from "@/components/ui";
import type { FieldDef, Row } from "@/data/types";
import type { SummaryRowLocation } from "@/features/settings/schema";
import { useI18n } from "@/i18n";
import { HeaderCell } from "./HeaderCell";
import { Pager } from "./Pager";
import { TotalsRow, type CellBase } from "./TotalsRow";
import { renderCell } from "./cells";
import { WINDOW_THRESHOLD, chosenPageSize, pageSizeOptions, pageSlice, resolveOption, toPageSize } from "./paging";
import { BodyCell, GridScroll, GridTableBox, SpacerCell, Tfoot, WideCell } from "./parts";
import type { SortRule } from "./sort";
import { computeTotal, type TotalKind, type TotalResult } from "./totals";
import { ROW_MARK, useRowWindow } from "./useRowWindow";

const HEADER_ROWS = 1;
const SHOWS_TOP: ReadonlySet<SummaryRowLocation> = new Set(["top", "both"]);
const SHOWS_BOTTOM: ReadonlySet<SummaryRowLocation> = new Set(["bottom", "both"]);
const ROW_MARK_PROPS = { [ROW_MARK]: "" };

/** Everything the tables of one grid have in common; a grouped grid passes the same object to every group table. */
export interface TableShared {
  /** Visible fields, in display order. */
  fields: readonly FieldDef[];
  sorts: readonly SortRule[];
  onSort: (key: string) => void;
  groupBy: readonly string[];
  onToggleGroup: (key: string) => void;
  kinds: Readonly<Record<string, TotalKind>>;
  /** User setting: where the totals row sits. */
  totalsPosition: SummaryRowLocation;
  /** User setting: the header stays at the top of the scroll area. */
  pinHeader: boolean;
  /** Column being moved in the columns panel. */
  highlight: string | null;
  /** The page size the view asks for; each table resolves it against its own row count. */
  pageSize: number;
  onPageSize: (pageSize: number) => void;
  cell: CellBase;
  /** Shown in place of rows when there are none. */
  emptyText: string;
}

interface GridRowProps {
  row: Row;
  /** One-based position among all rows of the table, counting the header row. */
  rowIndex: number;
  fields: readonly FieldDef[];
  levels: ReadonlyMap<string, number>;
  highlight: string | null;
  cell: CellBase;
}

// Memoised on the row object, so a cell that reads sibling fields (the currency code) re-renders when they change.
const GridRow = memo(function GridRow({ row, rowIndex, fields, levels, highlight, cell }: GridRowProps) {
  return (
    <Tr aria-rowindex={rowIndex} {...ROW_MARK_PROPS}>
      {fields.map((field) => (
        <BodyCell key={field.key} $level={levels.get(field.key)} $highlight={highlight === field.key}>
          {renderCell(row[field.key], { ...cell, field, row })}
        </BodyCell>
      ))}
    </Tr>
  );
});

interface GridTableProps {
  shared: TableShared;
  /** Names the table for screen readers: the report, or the group. */
  caption: string;
  /** Every row of this table, already sorted. Totals cover all of them; the table pages them itself. */
  rows: readonly Row[];
  /** Zero-based page. */
  page: number;
  onPage: (page: number) => void;
}

/** One table: sticky header with sort and group controls, windowed body, totals row and the pagination footer. */
export function GridTable({ shared, caption, rows, page, onPage }: GridTableProps) {
  const { fields, sorts, kinds, totalsPosition, pinHeader, highlight, cell } = shared;
  const { t } = useI18n();
  const count = rows.length;

  const { options, limited } = useMemo(() => pageSizeOptions(count), [count]);
  const option = resolveOption({ wanted: shared.pageSize, options, count });
  const slice = pageSlice({ count, page, pageSize: toPageSize(option) });
  const pageRows = useMemo(() => rows.slice(slice.start, slice.end), [rows, slice.start, slice.end]);
  const windowed = pageRows.length > WINDOW_THRESHOLD;
  const { scrollRef, start, end, rowHeight } = useRowWindow(pageRows, windowed);

  const levels = useMemo(() => new Map(sorts.map((rule, level) => [rule.key, level])), [sorts]);
  const totals = useMemo(() => {
    const results: Record<string, TotalResult> = {};
    if (totalsPosition === "none") return results;
    for (const field of fields) {
      if (field.key in kinds) results[field.key] = computeTotal({ rows, field, kind: kinds[field.key] });
    }
    return results;
  }, [rows, fields, kinds, totalsPosition]);
  const totalsRow = (edge: "top" | "bottom") => (
    <TotalsRow edge={edge} fields={fields} kinds={kinds} totals={totals} count={count} underHeader={pinHeader} cell={cell} />
  );

  return (
    <Stack $gap="sm">
      {/* Focusable and named, so keyboard users can scroll the table sideways. */}
      <GridScroll ref={scrollRef} tabIndex={0} role="region" aria-label={t("gridx.scrollLabel", { name: caption })}>
        <GridTableBox aria-rowcount={windowed ? count + HEADER_ROWS : undefined}>
          <Caption>{caption}</Caption>
          <Thead>
            <Tr>
              {fields.map((field) => (
                <HeaderCell
                  key={field.key}
                  field={field}
                  sorts={sorts}
                  onSort={shared.onSort}
                  pinned={pinHeader}
                  highlight={highlight === field.key}
                  groupBy={shared.groupBy}
                  onToggleGroup={shared.onToggleGroup}
                />
              ))}
            </Tr>
            {SHOWS_TOP.has(totalsPosition) ? totalsRow("top") : null}
          </Thead>
          <Tbody>
            {count === 0 ? (
              <Tr>
                <WideCell colSpan={fields.length}>{shared.emptyText}</WideCell>
              </Tr>
            ) : null}
            {start > 0 ? (
              <Tr aria-hidden>
                <SpacerCell colSpan={fields.length} $height={start * rowHeight} />
              </Tr>
            ) : null}
            {pageRows.slice(start, end).map((row, index) => {
              const position = slice.start + start + index;
              return (
                <GridRow
                  key={position}
                  row={row}
                  rowIndex={position + HEADER_ROWS + 1}
                  fields={fields}
                  levels={levels}
                  highlight={highlight}
                  cell={cell}
                />
              );
            })}
            {end < pageRows.length ? (
              <Tr aria-hidden>
                <SpacerCell colSpan={fields.length} $height={(pageRows.length - end) * rowHeight} />
              </Tr>
            ) : null}
          </Tbody>
          {SHOWS_BOTTOM.has(totalsPosition) ? <Tfoot>{totalsRow("bottom")}</Tfoot> : null}
        </GridTableBox>
      </GridScroll>
      <Pager
        count={count}
        slice={slice}
        options={options}
        limited={limited}
        option={option}
        format={cell.format}
        onPage={onPage}
        onOption={(wanted) => {
          shared.onPageSize(chosenPageSize({ wanted, options, count }));
          onPage(0);
        }}
      />
    </Stack>
  );
}
