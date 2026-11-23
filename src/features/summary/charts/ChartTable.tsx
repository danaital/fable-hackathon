"use client";

import { Caption, Ltr, Table, TableScroll, Tbody, Td, Thead, Tr } from "@/components/ui";
import { useI18n } from "@/i18n";
import type { ValueFormat } from "./ChartTooltip";
import type { ChartModel } from "./model";
import { HeadCell } from "./primitives";

interface ChartTableProps extends ValueFormat {
  title: string;
  /** Header of the first column: the name of the category field. */
  categoryLabel: string;
  model: ChartModel;
}

/** The chart's numbers as a real table: a row per visible category, a column per visible series, shares where the chart shows them. */
export function ChartTable({ title, categoryLabel, model, formatValue, formatShare }: ChartTableProps) {
  const { t } = useI18n();
  return (
    <TableScroll>
      <Table>
        <Caption>{title}</Caption>
        <Thead>
          <Tr>
            <HeadCell scope="col">{categoryLabel}</HeadCell>
            {model.series.map((series) => (
              <HeadCell key={series.key} scope="col" $end>
                {series.label}
              </HeadCell>
            ))}
          </Tr>
        </Thead>
        <Tbody>
          {model.categories.map((category, index) => (
            <Tr key={category.key}>
              <HeadCell scope="row">{category.label}</HeadCell>
              {model.series.map((series) => {
                const value = formatValue(series.values[index] ?? 0);
                const share = series.shares[index] ?? null;
                return (
                  <Td key={series.key} $end>
                    <Ltr>{share === null ? value : t("summary.chart.shareOfAll", { value, percent: formatShare(share) })}</Ltr>
                  </Td>
                );
              })}
            </Tr>
          ))}
        </Tbody>
      </Table>
    </TableScroll>
  );
}
