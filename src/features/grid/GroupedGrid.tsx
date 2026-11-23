"use client";

import { ArrowDown, ArrowUp, ChevronDown, ChevronLeft, ChevronRight, ChevronsDownUp, ChevronsUpDown, type LucideIcon } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { Button, Heading, Label, Select, Stack, Text, VisuallyHidden } from "@/components/ui";
import type { FieldDef } from "@/data/types";
import { useI18n, type I18nKey } from "@/i18n";
import { GridTable, type TableShared } from "./GridTable";
import { displayText } from "./cells";
import { GroupBody, GroupSection, GroupToggle } from "./parts";
import { AMOUNT_TYPES, GROUP_ORDERS, type GroupOrder, type GroupOrderBy, type RowGroup } from "./prepare";
import type { SortDirection } from "./sort";

const ICON_SIZE = 16;
const PART_SEPARATOR = " | ";
const NO_FIELD = "";
const ORDER_LABEL: Record<GroupOrderBy, I18nKey> = {
  dataOrder: "gridx.group.order.dataOrder",
  name: "gridx.group.order.name",
  rowCount: "gridx.group.order.rowCount",
  amount: "gridx.group.order.amount",
};
const DIRECTION_LABEL: Record<SortDirection, I18nKey> = { asc: "gridx.group.direction.asc", desc: "gridx.group.direction.desc" };
const DIRECTION_ICON: Record<SortDirection, LucideIcon> = { asc: ArrowUp, desc: ArrowDown };
const FLIPPED: Record<SortDirection, SortDirection> = { asc: "desc", desc: "asc" };
// A collapsed group's chevron points the reading way, so it mirrors in right-to-left.
const COLLAPSED_ICON: Record<"ltr" | "rtl", LucideIcon> = { ltr: ChevronRight, rtl: ChevronLeft };

interface GroupedGridProps {
  shared: TableShared;
  groups: readonly RowGroup[];
  /** The grouping fields, outermost first; `group.values` follows this order. */
  groupFields: readonly FieldDef[];
  /** Every field of the report; the numeric ones can order groups by amount. */
  allFields: readonly FieldDef[];
  order: GroupOrder;
  onOrder: (order: GroupOrder) => void;
}

/** One collapsible table per group, each with its own page and totals. Groups start collapsed and keep their state. */
export function GroupedGrid({ shared, groups, groupFields, allFields, order, onOrder }: GroupedGridProps) {
  const { t, dir } = useI18n();
  const idBase = useId();
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const [pages, setPages] = useState<Record<string, number>>({});
  const [status, setStatus] = useState("");
  const { cell } = shared;
  const amountFields = allFields.filter((field) => AMOUNT_TYPES.has(field.type));
  const DirectionIcon = DIRECTION_ICON[order.direction];
  const CollapsedIcon = COLLAPSED_ICON[dir];

  // The page size is shared: changing it in one group sends every group back to its first page.
  const groupShared = useMemo<TableShared>(
    () => ({
      ...shared,
      onPageSize: (pageSize) => {
        setPages({});
        shared.onPageSize(pageSize);
      },
    }),
    [shared],
  );
  const toggle = (key: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  const titleOf = (group: RowGroup) => {
    const parts = groupFields.map((field, level) =>
      t("gridx.group.part", { field: t(field.labelKey), value: displayText(group.values[level], { ...cell, field, row: {} }) }),
    );
    const rows = t("grid.rows", { count: cell.format.number(group.rows.length) });
    return t("gridx.group.heading", { title: parts.join(PART_SEPARATOR), rows });
  };

  return (
    <Stack $gap="md">
      <Stack $row $wrap $justify="space-between" $gap="sm">
        <Stack $row $wrap $gap="sm">
          <Text $muted $size="sm">
            {t("gridx.group.count", { count: cell.format.number(groups.length) })}
          </Text>
          <Button
            onClick={() => {
              setExpanded(new Set(groups.map((group) => group.key)));
              setStatus(t("gridx.group.expanded", { count: cell.format.number(groups.length) }));
            }}
          >
            <ChevronsUpDown size={ICON_SIZE} aria-hidden />
            {t("gridx.group.expandAll")}
          </Button>
          <Button
            onClick={() => {
              setExpanded(new Set());
              setStatus(t("gridx.group.collapsed"));
            }}
          >
            <ChevronsDownUp size={ICON_SIZE} aria-hidden />
            {t("gridx.group.collapseAll")}
          </Button>
          <VisuallyHidden role="status">{status}</VisuallyHidden>
        </Stack>
        <Stack $row $wrap $gap="sm">
          <Label htmlFor={`${idBase}-order`}>
            {t("gridx.group.orderBy")}
            <Select
              id={`${idBase}-order`}
              value={order.by}
              onChange={(event) => onOrder({ ...order, by: GROUP_ORDERS.find((by) => by === event.target.value) ?? "dataOrder" })}
            >
              {GROUP_ORDERS.map((by) => (
                <option key={by} value={by}>
                  {t(ORDER_LABEL[by])}
                </option>
              ))}
            </Select>
          </Label>
          {order.by === "amount" ? (
            <Label htmlFor={`${idBase}-amount`}>
              {t("gridx.group.amountField")}
              <Select
                id={`${idBase}-amount`}
                value={order.amountField ?? NO_FIELD}
                onChange={(event) => onOrder({ ...order, amountField: event.target.value || undefined })}
              >
                <option value={NO_FIELD}>{t("gridx.group.amountChoose")}</option>
                {amountFields.map((field) => (
                  <option key={field.key} value={field.key}>
                    {t(field.labelKey)}
                  </option>
                ))}
              </Select>
            </Label>
          ) : null}
          {/* Data order has no direction. */}
          <Button
            $icon
            disabled={order.by === "dataOrder"}
            aria-label={t(DIRECTION_LABEL[order.direction])}
            title={t(DIRECTION_LABEL[order.direction])}
            onClick={() => onOrder({ ...order, direction: FLIPPED[order.direction] })}
          >
            <DirectionIcon size={ICON_SIZE} aria-hidden />
          </Button>
        </Stack>
      </Stack>

      {groups.map((group, index) => {
        const open = expanded.has(group.key);
        const title = titleOf(group);
        const bodyId = `${idBase}-group-${index}`;
        const Chevron = open ? ChevronDown : CollapsedIcon;
        return (
          <GroupSection key={group.key}>
            <Heading as="h3" $size="sm">
              <GroupToggle $variant="ghost" aria-expanded={open} aria-controls={bodyId} onClick={() => toggle(group.key)}>
                <Chevron size={ICON_SIZE} aria-hidden />
                {title}
              </GroupToggle>
            </Heading>
            {open ? (
              <GroupBody id={bodyId}>
                <GridTable
                  shared={groupShared}
                  caption={title}
                  rows={group.rows}
                  page={pages[group.key] ?? 0}
                  onPage={(page) => setPages((current) => ({ ...current, [group.key]: page }))}
                />
              </GroupBody>
            ) : null}
          </GroupSection>
        );
      })}
    </Stack>
  );
}
