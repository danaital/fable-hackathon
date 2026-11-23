"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { Button, Checkbox, Field, Input, Notice, Select, Stack, Text } from "@/components/ui";
import { AGGREGATES } from "@/features/report/viewState";
import { useI18n } from "@/i18n";
import type { SummaryField } from "../schema";
import { calcsFor } from "../summary";
import { ICON_SIZE, ListRow, Option, RowActions, pickOption } from "../ui";
import type { StepProps } from "./types";

const LABEL_MAX = 80;
const NOT_PICKED = "";

/** The summary row: on or off, its label, and one fixed calculation per field. */
export function SummaryStep({ state, dispatch, page }: StepProps) {
  const { t } = useI18n();
  const { fields } = page.report;
  const { summary } = state;
  const [fieldKey, setFieldKey] = useState(NOT_PICKED);
  const patch = (next: Partial<typeof summary>) => dispatch({ type: "patch", patch: { summary: { ...summary, ...next } } });
  const setFields = (next: SummaryField[]) => patch({ fields: next });
  const unconfigured = fields.filter((field) => !summary.fields.some((config) => config.field === field.key));

  const add = () => {
    const field = fields.find((candidate) => candidate.key === fieldKey);
    if (field) setFields([...summary.fields, { field: field.key, calc: calcsFor(field.type)[0] }]);
    setFieldKey(NOT_PICKED);
  };

  return (
    <>
      <Checkbox checked={summary.enabled} onChange={(enabled) => patch({ enabled })}>
        {t("export.summary.enable")}
      </Checkbox>
      {summary.enabled ? (
        <>
          <Field label={t("export.summary.label")} hint={t("export.summary.labelHint")}>
            {(id) => <Input id={id} value={summary.label} maxLength={LABEL_MAX} onChange={(event) => patch({ label: event.target.value })} />}
          </Field>
          <Text $muted $size="sm">
            {t("export.summary.hint")}
          </Text>
          {summary.fields.length === 0 ? <Notice>{t("export.summary.empty")}</Notice> : null}
          {summary.fields.map((config) => {
            const field = fields.find((candidate) => candidate.key === config.field);
            if (!field) return null;
            const name = t(field.labelKey);
            return (
              <ListRow key={config.field}>
                <Stack $row $wrap $gap="sm">
                  <Text $size="sm">{name}</Text>
                  <Select
                    aria-label={t("export.summary.calcFor", { name })}
                    value={config.calc}
                    onChange={(event) =>
                      setFields(summary.fields.map((other) => (other.field === config.field ? { ...other, calc: pickOption(AGGREGATES, event.target.value, other.calc) } : other)))
                    }
                  >
                    {calcsFor(field.type).map((calc) => (
                      <Option key={calc} value={calc}>
                        {t(`export.calc.${calc}`)}
                      </Option>
                    ))}
                  </Select>
                </Stack>
                <RowActions name={name} movable={false} onRemove={() => setFields(summary.fields.filter((other) => other.field !== config.field))} />
              </ListRow>
            );
          })}
          <Stack $row $wrap $gap="sm" $align="end">
            <Field label={t("export.summary.addField")}>
              {(id) => (
                <Select id={id} value={fieldKey} onChange={(event) => setFieldKey(event.target.value)}>
                  <Option value={NOT_PICKED}>{t("export.chooseField")}</Option>
                  {unconfigured.map((field) => (
                    <Option key={field.key} value={field.key}>
                      {t(field.labelKey)}
                    </Option>
                  ))}
                </Select>
              )}
            </Field>
            <Button disabled={!fieldKey} onClick={add}>
              <Plus size={ICON_SIZE} aria-hidden />
              {t("export.summary.add")}
            </Button>
          </Stack>
        </>
      ) : null}
    </>
  );
}
