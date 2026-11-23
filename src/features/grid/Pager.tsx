"use client";

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, type LucideIcon } from "lucide-react";
import { useId } from "react";
import { Button, Label, Select, Stack, Text, VisuallyHidden } from "@/components/ui";
import { useI18n, type I18nKey } from "@/i18n";
import type { Formatters } from "@/lib/format";
import { ALL_OPTION, type PageSlice } from "./paging";

const ICON_SIZE = 16;
// Keeps "26–50" in reading order inside right-to-left text (left-to-right isolate, then pop).
const LTR_ISOLATE = "⁦";
const POP_ISOLATE = "⁩";

const STEPS = ["first", "prev", "next", "last"] as const;
type Step = (typeof STEPS)[number];
const STEP_LABEL: Record<Step, I18nKey> = { first: "gridx.page.first", prev: "grid.prev", next: "grid.next", last: "gridx.page.last" };
// The icons swap in right-to-left so each still points the reading way.
const STEP_ICON: Record<"ltr" | "rtl", Record<Step, LucideIcon>> = {
  ltr: { first: ChevronsLeft, prev: ChevronLeft, next: ChevronRight, last: ChevronsRight },
  rtl: { first: ChevronsRight, prev: ChevronRight, next: ChevronLeft, last: ChevronsLeft },
};

interface PagerProps {
  /** Rows in the table, on all pages. */
  count: number;
  slice: PageSlice;
  /** Offered page-size options; ALL_OPTION stands for "All". */
  options: readonly number[];
  /** The option list was shortened because the row count is very large. */
  limited: boolean;
  option: number;
  format: Formatters;
  onPage: (page: number) => void;
  onOption: (option: number) => void;
}

/** The pagination footer: rows per page, the range shown, and first / previous / next / last. */
export function Pager({ count, slice, options, limited, option, format, onPage, onOption }: PagerProps) {
  const { t, dir } = useI18n();
  const selectId = useId();
  const lastPage = slice.pageCount - 1;
  const target: Record<Step, number> = { first: 0, prev: slice.page - 1, next: slice.page + 1, last: lastPage };
  const blocked: Record<Step, boolean> = { first: slice.page === 0, prev: slice.page === 0, next: slice.page >= lastPage, last: slice.page >= lastPage };
  const range = {
    start: format.number(count === 0 ? 0 : slice.start + 1),
    end: format.number(slice.end),
    total: format.number(count),
  };

  return (
    <Stack $row $wrap $justify="space-between" $gap="md">
      <Stack $row $wrap $gap="sm">
        <Label htmlFor={selectId}>
          {t("grid.pageSize")}
          <Select id={selectId} value={option} onChange={(event) => onOption(Number(event.target.value))}>
            {options.map((size) => (
              <option key={size} value={size}>
                {size === ALL_OPTION ? t("gridx.page.all") : format.number(size)}
              </option>
            ))}
          </Select>
        </Label>
        {limited ? (
          <Text $muted $size="xs" title={t("gridx.page.limitedHint")}>
            {t("gridx.page.limited")}
            <VisuallyHidden>{t("gridx.page.limitedHint")}</VisuallyHidden>
          </Text>
        ) : null}
      </Stack>
      <Stack $row $wrap $gap="sm">
        <Text $size="sm" aria-hidden>
          {t("gridx.page.range", { ...range, start: `${LTR_ISOLATE}${range.start}`, end: `${range.end}${POP_ISOLATE}` })}
        </Text>
        <VisuallyHidden role="status">{t("gridx.page.announce", range)}</VisuallyHidden>
        <Text $muted $size="sm">
          {t("grid.page", { page: format.number(slice.page + 1), pages: format.number(slice.pageCount) })}
        </Text>
        <Stack $row $gap="xs">
          {STEPS.map((step) => {
            const Icon = STEP_ICON[dir][step];
            return (
              <Button key={step} $icon aria-label={t(STEP_LABEL[step])} title={t(STEP_LABEL[step])} disabled={blocked[step]} onClick={() => onPage(target[step])}>
                <Icon size={ICON_SIZE} aria-hidden />
              </Button>
            );
          })}
        </Stack>
      </Stack>
    </Stack>
  );
}
