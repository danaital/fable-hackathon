"use client";

import { useState } from "react";
import { Checkbox, Chip, Ltr, Stack } from "@/components/ui";
import { useI18n } from "@/i18n";
import { datePattern } from "../cells";
import { exportLocale, resolveColumns, resolveFileName, resolveGrouping, resolveRules, sourceDefinition } from "../plan";
import { Disclosure, DisclosureSummary, SummaryLine } from "../ui";
import type { StepProps } from "./types";

/** Last step: the two options about the info sheet, and every choice made on the way here, named. */
export function ReviewStep({ state, dispatch, page, fileTemplates }: StepProps) {
  const { t } = useI18n();
  const isWorkbook = state.format === "xlsx";
  const rules = resolveRules(state, page);
  const grouping = resolveGrouping(state, page.report);
  const activeFilters = rules.filters.filter((rule) => rule.enabled !== false).length;
  const sourceName = sourceDefinition(state, page)?.name;
  const hasSummary = state.summary.enabled && state.summary.fields.length > 0;
  const charts = state.charts.selected.filter((id) => page.charts.some((chart) => chart.id === id)).length;
  const style = fileTemplates.find((template) => template.id === state.fileTemplateId);
  const off = t("export.review.off");
  // One timestamp per visit, so the name shown does not change on every render.
  const [now] = useState(() => new Date());

  return (
    <>
      <Stack $gap="sm">
        <Checkbox checked={state.includeMetadata} onChange={(includeMetadata) => dispatch({ type: "patch", patch: { includeMetadata } })}>
          {t(isWorkbook ? "export.review.metadata.xlsx" : "export.review.metadata.csv")}
        </Checkbox>
        <Checkbox
          checked={state.includeFilters && state.includeMetadata}
          disabled={!state.includeMetadata}
          onChange={(includeFilters) => dispatch({ type: "patch", patch: { includeFilters } })}
        >
          {t("export.review.includeFilters")}
        </Checkbox>
      </Stack>

      <Disclosure open>
        <DisclosureSummary>{t("export.review.summary")}</DisclosureSummary>
        <Stack $gap="sm">
          <SummaryLine label={t("export.step.format")}>{t(`export.format.${state.format}`)}</SummaryLine>
          <SummaryLine label={t("export.step.source")}>
            {sourceName ? t("export.review.sourceNamed", { source: t(`export.source.${state.source}`), name: sourceName }) : t(`export.source.${state.source}`)}
          </SummaryLine>
          <SummaryLine label={t("export.step.fields")}>{t("export.review.fields", { count: resolveColumns(state, page).length })}</SummaryLine>
          <SummaryLine label={t("export.step.filters")}>
            {t("export.review.rules", { source: t(`export.ruleSource.${state.filtersSource}`), count: activeFilters })}
          </SummaryLine>
          <SummaryLine label={t("export.step.sort")}>
            {t("export.review.rules", { source: t(`export.ruleSource.${state.sortsSource}`), count: rules.sorts.length })}
          </SummaryLine>
          {isWorkbook ? (
            <>
              <SummaryLine label={t("export.step.summary")}>
                {hasSummary ? t("export.review.summaryOn", { count: state.summary.fields.length }) : off}
              </SummaryLine>
              <SummaryLine label={t("export.step.grouping")}>
                {grouping ? t("export.review.groupingOn", { mode: t(`export.grouping.${grouping.outputMode}`) }) : off}
              </SummaryLine>
              {grouping ? (
                <Stack $row $wrap $gap="xs">
                  {grouping.fields.map((field) => (
                    <Chip key={field.key}>{t(field.labelKey)}</Chip>
                  ))}
                </Stack>
              ) : null}
              {page.charts.length > 0 ? (
                <SummaryLine label={t("export.step.charts")}>
                  {state.charts.enabled && charts > 0 ? t("export.review.chartsOn", { count: charts }) : off}
                </SummaryLine>
              ) : null}
              <SummaryLine label={t("export.step.fileTemplate")}>
                {state.designMode === "existing" && style ? style.name : t("export.review.customStyle")}
              </SummaryLine>
            </>
          ) : null}
          <SummaryLine label={t("export.step.settings")}>
            {t(`export.lang.${exportLocale(state, page.uiLocale)}`)}, <Ltr>{datePattern(state.formatting)}</Ltr>
          </SummaryLine>
          <SummaryLine label={t("export.step.fileName")}>
            <Ltr>{`${resolveFileName(state, page, now)}.${state.format}`}</Ltr>
          </SummaryLine>
        </Stack>
      </Disclosure>
    </>
  );
}
