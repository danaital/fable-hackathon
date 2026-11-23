"use client";

import { Card, Grid, Heading, Ltr, Stack, Text } from "@/components/ui";
import { useI18n, type I18nKey } from "@/i18n";
import { createFormatters } from "@/lib/format";
import { ChoiceField, NumberField } from "./fields";
import {
  DATE_DELIMITERS,
  DATE_FORMATS,
  DATETIME_STRUCTURES,
  MAX_DECIMAL_DIGITS,
  MONTH_NAME_DATE_FORMATS,
  TIME_FORMATS,
  type FormattingSettings,
} from "./schema";

// Local time, so the examples read the same in every time zone.
const SAMPLE_DATE_TIME = "2026-02-10T14:30:00";
const SAMPLE_DATE = "2026-02-10";
const SAMPLE_NUMBER = 1234.5678;
const SAMPLE_PERCENT = 18.456;
const SAMPLE_CURRENCY = "USD";
const FIELD_MIN = "220px";

type DigitKey = "maxDigitsForNumbers" | "maxDigitsForCurrency" | "maxDigitsForPercent";
const DIGIT_LABELS: Record<DigitKey, I18nKey> = {
  maxDigitsForNumbers: "settings.digits.numbers",
  maxDigitsForCurrency: "settings.digits.currency",
  maxDigitsForPercent: "settings.digits.percent",
};
const DIGIT_KEYS = Object.keys(DIGIT_LABELS) as DigitKey[];

export interface FormattingFieldsProps {
  value: Partial<FormattingSettings>;
  effective: FormattingSettings;
  /** Report level: the user's values, offered as the "use my settings" choice. */
  inherited?: FormattingSettings;
  onChange: (patch: Partial<FormattingSettings>) => void;
}

/** Date, time and decimal settings. Option labels are examples rendered with that option. */
export function FormattingFields({ value, effective, inherited, onChange }: FormattingFieldsProps) {
  const { t, locale } = useI18n();
  const example = (patch: Partial<FormattingSettings>) => createFormatters(locale, { ...effective, ...patch });
  // At user level an empty number is invalid (NaN fails validation); at report level it means "inherit".
  const empty = inherited ? undefined : Number.NaN;

  return (
    <Stack $gap="lg">
      <Grid $min={FIELD_MIN}>
        <ChoiceField
          label={t("settings.dateFormat")}
          value={value.dateFormat}
          options={DATE_FORMATS}
          optionLabel={(dateFormat) => example({ dateFormat }).date(SAMPLE_DATE)}
          inherited={inherited?.dateFormat}
          onChange={(dateFormat) => onChange({ dateFormat })}
        />
        <ChoiceField
          label={t("settings.dateDelimiter")}
          value={value.dateDelimiter}
          options={DATE_DELIMITERS}
          optionLabel={(delimiter) => t(`settings.delimiter.${delimiter}`)}
          inherited={inherited?.dateDelimiter}
          hint={MONTH_NAME_DATE_FORMATS.includes(effective.dateFormat) ? t("settings.dateDelimiter.hint") : undefined}
          onChange={(dateDelimiter) => onChange({ dateDelimiter })}
        />
        <ChoiceField
          label={t("settings.timeFormat")}
          value={value.timeFormat}
          options={TIME_FORMATS}
          optionLabel={(timeFormat) => example({ timeFormat, datetimeStructure: "time_date_space" }).dateTime(SAMPLE_DATE_TIME)}
          inherited={inherited?.timeFormat}
          onChange={(timeFormat) => onChange({ timeFormat })}
        />
        <ChoiceField
          label={t("settings.datetimeStructure")}
          value={value.datetimeStructure}
          options={DATETIME_STRUCTURES}
          optionLabel={(datetimeStructure) => example({ datetimeStructure }).dateTime(SAMPLE_DATE_TIME)}
          inherited={inherited?.datetimeStructure}
          onChange={(datetimeStructure) => onChange({ datetimeStructure })}
        />
      </Grid>
      <Heading as="h3" $size="md">
        {t("settings.numbers")}
      </Heading>
      <Grid $min={FIELD_MIN}>
        {DIGIT_KEYS.map((key) => (
          <NumberField
            key={key}
            label={t(DIGIT_LABELS[key])}
            value={value[key]}
            min={0}
            max={MAX_DECIMAL_DIGITS}
            inherited={inherited?.[key]}
            onChange={(digits) => onChange({ [key]: digits ?? empty })}
          />
        ))}
      </Grid>
      <FormattingPreview formatting={effective} />
    </Stack>
  );
}

/** Sample values formatted with the settings on screen, unsaved ones included. */
export function FormattingPreview({ formatting }: { formatting: FormattingSettings }) {
  const { t, locale } = useI18n();
  const format = createFormatters(locale, formatting);
  const samples: [I18nKey, string][] = [
    ["settings.preview.date", format.date(SAMPLE_DATE)],
    ["settings.preview.dateTime", format.dateTime(SAMPLE_DATE_TIME)],
    ["settings.preview.number", format.number(SAMPLE_NUMBER)],
    ["settings.preview.currency", format.currency(SAMPLE_NUMBER, SAMPLE_CURRENCY)],
    ["settings.preview.percent", format.percent(SAMPLE_PERCENT)],
  ];
  return (
    <Card as="section" aria-label={t("settings.preview")}>
      <Stack $gap="sm">
        <Heading as="h3" $size="md">
          {t("settings.preview")}
        </Heading>
        {samples.map(([label, sample]) => (
          <Stack key={label} $row $wrap $justify="space-between" $gap="sm">
            <Text $muted $size="sm">
              {t(label)}
            </Text>
            <Text $medium>
              <Ltr>{sample}</Ltr>
            </Text>
          </Stack>
        ))}
      </Stack>
    </Card>
  );
}
