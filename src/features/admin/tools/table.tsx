"use client";

import { useState, type ReactNode } from "react";
import styled, { css } from "styled-components";
import { Button, Caption, Notice, Stack, Table, TableScroll, Tbody, Td, Text, Th, Thead, Tr } from "@/components/ui";
import { useI18n } from "@/i18n";

export const DEFAULT_PAGE_SIZE = 15;

// On a phone the table becomes stacked cards: one card per row, each cell a "label: value" line.
// The explicit roles keep the table semantics that `display` changes would otherwise drop.
const Scroll = styled(TableScroll)`
  ${({ theme: { bp } }) => css`
    @media (max-width: ${bp.mobile}) {
      overflow: visible;
      border: 0;
      background: transparent;
    }
  `}
`;

const CardTable = styled(Table)`
  ${({ theme: { bp, space } }) => css`
    @media (max-width: ${bp.mobile}) {
      display: block;
      & > thead {
        position: absolute;
        inline-size: 1px;
        block-size: 1px;
        overflow: hidden;
        clip-path: inset(50%);
      }
      & > tbody {
        display: flex;
        flex-direction: column;
        gap: ${space.md};
      }
    }
  `}
`;

const Row = styled(Tr)`
  ${({ theme: { bp, color, radius, space } }) => css`
    @media (max-width: ${bp.mobile}) {
      display: flex;
      flex-direction: column;
      padding: ${space.sm};
      border: 1px solid ${color.border};
      border-radius: ${radius.md};
      background: ${color.surface};
    }
  `}
`;

const HeadCell = styled(Th)`
  ${({ theme: { space } }) => css`
    padding-block: ${space.sm};
    padding-inline: ${space.md};
  `}
`;

const Cell = styled(Td)`
  ${({ theme: { bp, color, font, space } }) => css`
    white-space: normal;
    overflow-wrap: anywhere;
    @media (max-width: ${bp.mobile}) {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: ${space.md};
      max-inline-size: none;
      overflow: visible;
      border: 0;
      text-align: end;
      &::before {
        content: attr(data-label);
        flex: none;
        color: ${color.textMuted};
        font-size: ${font.size.xs};
        text-align: start;
      }
    }
  `}
`;

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
}

interface DataTableProps<T> {
  /** Names the table for screen readers. */
  caption: string;
  columns: readonly Column<T>[];
  rows: readonly T[];
  rowKey: (row: T) => string | number;
  /** Shown instead of the table when there are no rows. */
  empty: string;
  pageSize?: number;
  /** When this changes (a new search, a new filter) the table returns to page 1. */
  resetKey?: string;
}

export function DataTable<T>({ caption, columns, rows, rowKey, empty, pageSize = DEFAULT_PAGE_SIZE, resetKey = "" }: DataTableProps<T>) {
  const { t } = useI18n();
  const [paging, setPaging] = useState({ page: 0, resetKey });
  if (paging.resetKey !== resetKey) setPaging({ page: 0, resetKey });

  if (rows.length === 0) return <Notice role="status">{empty}</Notice>;
  const pageCount = Math.ceil(rows.length / pageSize);
  const page = Math.min(paging.page, pageCount - 1);
  const goTo = (next: number) => setPaging({ page: next, resetKey });

  return (
    <Stack $gap="sm">
      <Scroll>
        <CardTable role="table">
          <Caption>{caption}</Caption>
          <Thead role="rowgroup">
            <Tr role="row">
              {columns.map((column) => (
                <HeadCell key={column.key} role="columnheader" scope="col">
                  {column.header}
                </HeadCell>
              ))}
            </Tr>
          </Thead>
          <Tbody role="rowgroup">
            {rows.slice(page * pageSize, (page + 1) * pageSize).map((row) => (
              <Row key={rowKey(row)} role="row">
                {columns.map((column) => (
                  <Cell key={column.key} role="cell" data-label={column.header}>
                    {column.cell(row)}
                  </Cell>
                ))}
              </Row>
            ))}
          </Tbody>
        </CardTable>
      </Scroll>
      {pageCount > 1 ? (
        <Stack $row $wrap $gap="sm" $justify="end">
          <Text $muted $size="sm" role="status">
            {t("adminTools.pager.status", { page: page + 1, pages: pageCount, count: rows.length })}
          </Text>
          <Button type="button" disabled={page === 0} onClick={() => goTo(page - 1)}>
            {t("adminTools.pager.previous")}
          </Button>
          <Button type="button" disabled={page >= pageCount - 1} onClick={() => goTo(page + 1)}>
            {t("adminTools.pager.next")}
          </Button>
        </Stack>
      ) : null}
    </Stack>
  );
}
