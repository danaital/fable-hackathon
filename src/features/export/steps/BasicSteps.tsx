"use client";

import { useState } from "react";
import { Checkbox, Field, Input, Ltr, Notice, Select, Stack, Text } from "@/components/ui";
import { useI18n } from "@/i18n";
import { resolveFileName } from "../plan";
import { CSV_DELIMITERS, EXPORT_FORMATS } from "../schema";
import { ChoiceCards, Option, pickOption, toggleItem } from "../ui";
import type { StepProps } from "./types";

const FILE_NAME_MAX = 120;

export function FormatStep({ state, dispatch }: StepProps) {
  const { t } = useI18n();
  return (
    <>
      <ChoiceCards
        legend={t("export.format.legend")}
        name="export-format"
        value={state.format}
        options={EXPORT_FORMATS.map((format) => ({
          value: format,
          title: t(`export.format.${format}`),
          description: t(`export.format.${format}.desc`),
        }))}
        onChange={(format) => dispatch({ type: "patch", patch: { format } })}
      />
      {state.format === "csv" ? (
        <Field label={t("export.csv.delimiter")} hint={t("export.csv.hint")}>
          {(id) => (
            <Select
              id={id}
              value={state.csvDelimiter}
              onChange={(event) =>
                dispatch({ type: "patch", patch: { csvDelimiter: pickOption(CSV_DELIMITERS, event.target.value, state.csvDelimiter) } })
              }
            >
              {CSV_DELIMITERS.map((delimiter) => (
                <Option key={delimiter} value={delimiter}>
                  {t(`export.csv.delimiter.${delimiter}`)}
                </Option>
              ))}
            </Select>
          )}
        </Field>
      ) : null}
    </>
  );
}

export function FileNameStep({ state, dispatch, page }: StepProps) {
  const { t } = useI18n();
  // One timestamp per visit, so the suggested name does not change while the user reads it.
  const [now] = useState(() => new Date());
  const suggested = resolveFileName({ ...state, fileName: "" }, page, now);
  const finalName = resolveFileName(state, page, now);
  return (
    <>
      <Notice $tone="info">{t("export.fileName.info")}</Notice>
      <Field label={t("export.fileName.label")} hint={t("export.fileName.hint")}>
        {(id) => (
          <Input
            id={id}
            value={state.fileName}
            maxLength={FILE_NAME_MAX}
            placeholder={suggested}
            onChange={(event) => dispatch({ type: "patch", patch: { fileName: event.target.value } })}
          />
        )}
      </Field>
      <Text $size="sm" role="status">
        {t("export.fileName.result")} <Ltr>{`${finalName}.${state.format}`}</Ltr>
      </Text>
    </>
  );
}

export function ChartsStep({ state, dispatch, page }: StepProps) {
  const { t, locale } = useI18n();
  const { enabled, selected } = state.charts;
  // A stored chart id that no longer exists is not counted.
  const known = selected.filter((id) => page.charts.some((chart) => chart.id === id));
  const setSelected = (next: string[]) => dispatch({ type: "patch", patch: { charts: { enabled, selected: next } } });
  const allSelected = known.length === page.charts.length;

  return (
    <>
      <Checkbox checked={enabled} onChange={(next) => dispatch({ type: "patch", patch: { charts: { enabled: next, selected } } })}>
        {t("export.charts.enable")}
      </Checkbox>
      <Text $muted $size="sm">
        {t("export.charts.hint")}
      </Text>
      {enabled ? (
        <Stack $gap="sm">
          <Stack $row $wrap $gap="md" $justify="space-between">
            <Text $size="sm" role="status">
              {t("export.charts.count", { selected: known.length, total: page.charts.length })}
            </Text>
            <Checkbox checked={allSelected} onChange={(all) => setSelected(all ? page.charts.map((chart) => chart.id) : [])}>
              {t("export.charts.all")}
            </Checkbox>
          </Stack>
          {page.charts.map((chart) => (
            <Checkbox key={chart.id} checked={known.includes(chart.id)} onChange={(on) => setSelected(toggleItem(known, chart.id, on))}>
              {chart.title[locale]}
            </Checkbox>
          ))}
        </Stack>
      ) : null}
    </>
  );
}
