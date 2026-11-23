"use client";

import { Coins } from "lucide-react";
import type { ReactNode } from "react";
import { Badge, Ltr, Stack, Tr, VisuallyHidden } from "@/components/ui";
import type { FieldDef, FieldType } from "@/data/types";
import type { I18nKey } from "@/i18n";
import { displayText, renderCell, type CellContext } from "./cells";
import { Muted, TotalCell } from "./parts";
import { labelColumn, type TotalKind, type TotalResult } from "./totals";

const ICON_SIZE = 14;
const LIST_SEPARATOR = ", ";
const ELLIPSIS = "…";
const DATE_TYPES: ReadonlySet<FieldType> = new Set(["date", "datetime"]);
const DATE_LABEL: Partial<Record<TotalKind, I18nKey>> = { min: "gridx.calc.dateMin", max: "gridx.calc.dateMax" };

/** Label of a calculation; minimum and maximum read as earliest and latest for dates. */
export const calcLabelKey = (kind: TotalKind, type: FieldType): I18nKey =>
  (DATE_TYPES.has(type) ? DATE_LABEL[kind] : undefined) ?? `gridx.calc.${kind}`;

export type CellBase = Omit<CellContext, "field" | "row">;

function totalValue({ result, field, base }: { result: TotalResult; field: FieldDef; base: CellBase }): ReactNode {
  const { format, t } = base;
  if (result.as === "field") {
    // A money result carries its currency; the cell reads it through the same hook as every other amount.
    const row = field.currencyKey ? { [field.currencyKey]: result.currency ?? null } : {};
    return renderCell(result.value, { ...base, field, row, search: undefined });
  }
  if (result.as === "number") return <Ltr>{format.number(result.value)}</Ltr>;
  if (result.as === "percent") return <Ltr>{format.percent(result.value)}</Ltr>;
  if (result.as === "days") return t("gridx.totals.days", { count: format.number(result.value) });
  if (result.as === "list") {
    const texts = result.values.map((value) => displayText(value, { ...base, field, row: {} }));
    return [...texts, ...(result.more > 0 ? [ELLIPSIS] : [])].join(LIST_SEPARATOR);
  }
  if (result.as === "mixed") {
    // No figure is shown for amounts in several currencies. The currency feature can add its "choose a currency" action here.
    return (
      <Badge $tone="warning" title={t("gridx.totals.mixedHint")}>
        <Coins size={ICON_SIZE} aria-hidden />
        {t("gridx.totals.mixed")}
        <VisuallyHidden>{t("gridx.totals.mixedHint")}</VisuallyHidden>
      </Badge>
    );
  }
  return renderCell(null, { ...base, field, row: {} });
}

interface TotalsRowProps {
  edge: "top" | "bottom";
  fields: readonly FieldDef[];
  kinds: Readonly<Record<string, TotalKind>>;
  totals: Readonly<Record<string, TotalResult>>;
  /** Number of rows being totalled. */
  count: number;
  /** The header is pinned, so a top totals row must stick below it. */
  underHeader: boolean;
  cell: CellBase;
}

/** The totals row: the "Total: N" label in the first column without a calculation, one result per calculated column. */
export function TotalsRow({ edge, fields, kinds, totals, count, underHeader, cell }: TotalsRowProps) {
  const { t, format } = cell;
  const labelAt = labelColumn(fields, kinds);
  const label = t("gridx.totals.label", { count: format.number(count) });

  return (
    <Tr>
      {fields.map((field, index) => {
        const kind = kinds[field.key];
        const result = totals[field.key];
        const calc = kind ? t(calcLabelKey(kind, field.type)) : "";
        return (
          <TotalCell key={field.key} $edge={edge} $underHeader={underHeader}>
            {index === labelAt ? label : null}
            {index !== labelAt && !(kind && result) ? totalValue({ result: { as: "empty" }, field, base: cell }) : null}
            {kind && result ? (
              <Stack $gap="xs" $align="center">
                {/* Every column is calculated: the label goes in front of the first column's value. */}
                {labelAt === -1 && index === 0 ? label : null}
                <VisuallyHidden>{t("gridx.totals.cell", { column: t(field.labelKey), calc })}</VisuallyHidden>
                <Muted aria-hidden>{calc}</Muted>
                {totalValue({ result, field, base: cell })}
              </Stack>
            ) : null}
          </TotalCell>
        );
      })}
    </Tr>
  );
}
