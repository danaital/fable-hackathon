"use client";

import { Checkbox, Field, Grid, Ltr, Select, Text } from "@/components/ui";
import type { FieldDef } from "@/data/types";
import { useI18n } from "@/i18n";
import { createFormatters } from "@/lib/format";
import { LOCALES } from "@/lib/prefs";
import { decimalsFor, exportCell } from "../cells";
import { exportLocale } from "../plan";
import { DATE_DELIMITERS, DATE_ORDERS, DATE_TIME_STRUCTURES, DECIMAL_CHOICES, TIME_FORMATS, type FormattingSettings } from "../schema";
import { translatorFor } from "../translate";
import { Fieldset, Legend, Option, pickOption } from "../ui";
import type { StepProps } from "./types";

const CONTROL_MIN_WIDTH = "200px";
const SAMPLE_NUMBER = 1234567.891;
const SAMPLE_DATE_TIME = "2026-03-09T14:05:00";
// The labelKey is never shown; the field only tells the cell formatter which type to format.
const SAMPLE_FIELD: FieldDef = { key: "sample", type: "datetime", labelKey: "export.settings.sample" };

interface ChoiceSelectProps<T extends string> {
  label: string;
  value: T;
  options: readonly T[];
  optionLabel: (option: T) => string;
  onChange: (value: T) => void;
  disabled?: boolean;
}

function ChoiceSelect<T extends string>({ label, value, options, optionLabel, onChange, disabled }: ChoiceSelectProps<T>) {
  return (
    <Field label={label}>
      {(id) => (
        <Select id={id} value={value} disabled={disabled} onChange={(event) => onChange(pickOption(options, event.target.value, value))}>
          {options.map((option) => (
            <Option key={option} value={option}>
              {optionLabel(option)}
            </Option>
          ))}
        </Select>
      )}
    </Field>
  );
}

/** Language and formats of the file. None of this changes the app's own language or direction. */
export function SettingsStep({ state, dispatch, page }: StepProps) {
  const { t } = useI18n();
  const { formatting } = state;
  const patch = (next: Partial<FormattingSettings>) => dispatch({ type: "patch", patch: { formatting: { ...formatting, ...next } } });

  const locale = exportLocale(state, page.uiLocale);
  const env = { format: createFormatters(locale), ...translatorFor(locale), formatting };
  const dateSample = exportCell(SAMPLE_FIELD, { [SAMPLE_FIELD.key]: SAMPLE_DATE_TIME }, env).text;
  const digits = decimalsFor("fraction", formatting, SAMPLE_NUMBER);
  // The spreadsheet app draws separators in the reader's own regional style; the browser's style is the closest preview.
  const numberSample = new Intl.NumberFormat(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    useGrouping: formatting.thousands,
  }).format(SAMPLE_NUMBER);

  return (
    <>
      <Fieldset>
        <Legend>{t("export.settings.language")}</Legend>
        <Checkbox checked={formatting.useDefaultLanguage} onChange={(useDefaultLanguage) => patch({ useDefaultLanguage })}>
          {t("export.settings.useAppLanguage")}
        </Checkbox>
        <ChoiceSelect
          label={t("export.settings.fileLanguage")}
          value={locale}
          options={LOCALES}
          optionLabel={(option) => t(`export.lang.${option}`)}
          disabled={formatting.useDefaultLanguage}
          onChange={(language) => patch({ language })}
        />
        <Text $muted $size="xs">
          {t("export.settings.languageHint")}
        </Text>
      </Fieldset>

      <Fieldset>
        <Legend>{t("export.settings.dates")}</Legend>
        <Grid $min={CONTROL_MIN_WIDTH}>
          <ChoiceSelect
            label={t("export.settings.dateOrder")}
            value={formatting.dateOrder}
            options={DATE_ORDERS}
            optionLabel={(option) => t(`export.settings.dateOrder.${option}`)}
            onChange={(dateOrder) => patch({ dateOrder })}
          />
          <ChoiceSelect
            label={t("export.settings.dateDelimiter")}
            value={formatting.dateDelimiter}
            options={DATE_DELIMITERS}
            optionLabel={(option) => option}
            onChange={(dateDelimiter) => patch({ dateDelimiter })}
          />
          <ChoiceSelect
            label={t("export.settings.timeFormat")}
            value={formatting.timeFormat}
            options={TIME_FORMATS}
            optionLabel={(option) => t(`export.settings.timeFormat.${option}`)}
            onChange={(timeFormat) => patch({ timeFormat })}
          />
          <ChoiceSelect
            label={t("export.settings.structure")}
            value={formatting.dateTimeStructure}
            options={DATE_TIME_STRUCTURES}
            optionLabel={(option) => t(`export.settings.structure.${option}`)}
            onChange={(dateTimeStructure) => patch({ dateTimeStructure })}
          />
        </Grid>
        <Text $size="sm" role="status">
          {t("export.settings.sample")} <Ltr>{dateSample}</Ltr>
        </Text>
      </Fieldset>

      <Fieldset>
        <Legend>{t("export.settings.numbers")}</Legend>
        <Grid $min={CONTROL_MIN_WIDTH}>
          <ChoiceSelect
            label={t("export.settings.decimals")}
            value={formatting.decimals}
            options={DECIMAL_CHOICES}
            optionLabel={(option) => (option === "auto" ? t("export.settings.decimals.auto") : option)}
            onChange={(decimals) => patch({ decimals })}
          />
          <Checkbox checked={formatting.thousands} onChange={(thousands) => patch({ thousands })}>
            {t("export.settings.thousands")}
          </Checkbox>
        </Grid>
        <Text $size="sm" role="status">
          {t("export.settings.sample")} <Ltr>{numberSample}</Ltr>
        </Text>
        <Text $muted $size="xs">
          {t("export.settings.numbersHint")}
        </Text>
      </Fieldset>
    </>
  );
}
