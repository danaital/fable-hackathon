"use client";

import { Checkbox, Chip, Notice, Stack, Text } from "@/components/ui";
import type { FieldType } from "@/data/types";
import { GROUPABLE_TYPES } from "@/features/grid/prepare";
import { useI18n } from "@/i18n";
import { OUTPUT_MODES } from "../schema";
import { ChoiceCards, Fieldset, Legend, toggleItem } from "../ui";
import type { StepProps } from "./types";

// The grid's label-like types, plus plain dates: grouping by day is common in a spreadsheet.
const EXPORT_GROUPABLE: ReadonlySet<FieldType> = new Set<FieldType>([...GROUPABLE_TYPES, "date"]);

export function GroupingStep({ state, dispatch, page }: StepProps) {
  const { t } = useI18n();
  const { grouping, summary } = state;
  const patch = (next: Partial<typeof grouping>) => dispatch({ type: "patch", patch: { grouping: { ...grouping, ...next } } });
  const groupable = page.report.fields.filter((field) => EXPORT_GROUPABLE.has(field.type));
  const hasSummary = summary.enabled && summary.fields.length > 0;
  const label = (key: string) => {
    const field = page.report.fields.find((candidate) => candidate.key === key);
    return field ? t(field.labelKey) : key;
  };

  return (
    <>
      {/* Turning grouping off clears the group fields, so a later "on" starts clean. */}
      <Checkbox checked={grouping.enabled} onChange={(enabled) => patch({ enabled, groupBy: enabled ? grouping.groupBy : [] })}>
        {t("export.grouping.enable")}
      </Checkbox>
      {grouping.enabled ? (
        <>
          <Fieldset>
            <Legend>{t("export.grouping.fields")}</Legend>
            <Stack $row $wrap $gap="md">
              {groupable.map((field) => (
                <Checkbox
                  key={field.key}
                  checked={grouping.groupBy.includes(field.key)}
                  onChange={(on) => patch({ groupBy: toggleItem(grouping.groupBy, field.key, on) })}
                >
                  {t(field.labelKey)}
                </Checkbox>
              ))}
            </Stack>
            {grouping.groupBy.length > 0 ? (
              <Stack $row $wrap $gap="xs" aria-label={t("export.grouping.order")} role="group">
                <Text $muted $size="sm">
                  {t("export.grouping.order")}
                </Text>
                {grouping.groupBy.map((key) => (
                  <Chip key={key}>{label(key)}</Chip>
                ))}
              </Stack>
            ) : null}
          </Fieldset>

          <ChoiceCards
            legend={t("export.grouping.output")}
            name="export-grouping-output"
            value={grouping.outputMode}
            options={OUTPUT_MODES.map((mode) => ({ value: mode, title: t(`export.grouping.${mode}`), description: t(`export.grouping.${mode}.desc`) }))}
            onChange={(outputMode) => patch({ outputMode })}
          />

          <Checkbox checked={grouping.innerSummary && hasSummary} disabled={!hasSummary} onChange={(innerSummary) => patch({ innerSummary })}>
            {t("export.grouping.innerSummary")}
          </Checkbox>
          {hasSummary ? null : <Notice>{t("export.grouping.innerSummaryNeedsSummary")}</Notice>}
          {grouping.outputMode === "split_with_summary" ? (
            <Checkbox checked={grouping.includeGrandTotal} onChange={(includeGrandTotal) => patch({ includeGrandTotal })}>
              {t("export.grouping.grandTotal")}
            </Checkbox>
          ) : null}
        </>
      ) : null}
    </>
  );
}
