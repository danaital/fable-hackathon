"use client";

import { ArrowDown, ArrowUp, ChevronsUpDown, Group, type LucideIcon } from "lucide-react";
import { Button, Ltr } from "@/components/ui";
import type { FieldDef } from "@/data/types";
import { useI18n, type I18nKey } from "@/i18n";
import { HeadCell, HeadInner, PriorityBadge } from "./parts";
import { GROUPABLE_TYPES } from "./prepare";
import type { SortDirection, SortRule } from "./sort";

const ICON_SIZE = 14;
const DIRECTION_ICON: Record<SortDirection, LucideIcon> = { asc: ArrowUp, desc: ArrowDown };
const BUTTON_NAME: Record<SortDirection, I18nKey> = { asc: "gridx.sort.name.asc", desc: "gridx.sort.name.desc" };
const BADGE_NAME: Record<SortDirection, I18nKey> = { asc: "gridx.sort.badge.asc", desc: "gridx.sort.badge.desc" };
const ARIA_SORT: Record<SortDirection, "ascending" | "descending"> = { asc: "ascending", desc: "descending" };

interface SortControlProps {
  field: FieldDef;
  sorts: readonly SortRule[];
  onSort: (key: string) => void;
}

/**
 * The sort button of a column: cycles ascending, descending, removed. Its name states the column, direction and
 * priority; the icon shows the direction and the numbered badge the priority, so neither relies on color.
 */
export function SortControl({ field, sorts, onSort }: SortControlProps) {
  const { t } = useI18n();
  const level = sorts.findIndex((rule) => rule.key === field.key);
  const rule = level >= 0 ? sorts[level] : undefined;
  const column = t(field.labelKey);
  const n = level + 1;
  const Icon = rule ? DIRECTION_ICON[rule.direction] : ChevronsUpDown;

  return (
    <Button
      $variant="ghost"
      aria-label={rule ? t(BUTTON_NAME[rule.direction], { column, n }) : t("gridx.sort.name.none", { column })}
      onClick={() => onSort(field.key)}
    >
      {column}
      <Icon size={ICON_SIZE} aria-hidden />
      {rule && sorts.length > 1 ? (
        <PriorityBadge $level={level} role="img" aria-label={t(BADGE_NAME[rule.direction], { n })} title={t(BADGE_NAME[rule.direction], { n })}>
          <Ltr>{n}</Ltr>
        </PriorityBadge>
      ) : null}
    </Button>
  );
}

interface HeaderCellProps extends SortControlProps {
  pinned: boolean;
  highlight: boolean;
  groupBy: readonly string[];
  onToggleGroup: (key: string) => void;
}

/** A column header: the sort button, and a "group by this column" toggle for fields that can be grouped. */
export function HeaderCell({ field, sorts, onSort, pinned, highlight, groupBy, onToggleGroup }: HeaderCellProps) {
  const { t } = useI18n();
  const level = sorts.findIndex((rule) => rule.key === field.key);
  const grouped = groupBy.includes(field.key);
  const groupName = t("gridx.group.byColumn", { column: t(field.labelKey) });

  return (
    <HeadCell
      scope="col"
      $pinned={pinned}
      $level={level >= 0 ? level : undefined}
      $highlight={highlight}
      // Only the first-priority column carries aria-sort; the other sorted columns state theirs in the button name.
      aria-sort={level === 0 ? ARIA_SORT[sorts[0].direction] : undefined}
    >
      <HeadInner>
        <SortControl field={field} sorts={sorts} onSort={onSort} />
        {GROUPABLE_TYPES.has(field.type) ? (
          <Button $variant="ghost" $icon $active={grouped} aria-pressed={grouped} aria-label={groupName} title={groupName} onClick={() => onToggleGroup(field.key)}>
            <Group size={ICON_SIZE} aria-hidden />
          </Button>
        ) : null}
      </HeadInner>
    </HeadCell>
  );
}
