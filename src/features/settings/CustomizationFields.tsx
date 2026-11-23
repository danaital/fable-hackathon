"use client";

import { Checkbox, Grid, Stack } from "@/components/ui";
import { useI18n } from "@/i18n";
import { ChoiceField, NumberField } from "./fields";
import { MIN_SEARCH_RANGE, SUMMARY_ROW_LOCATIONS, type CustomizationSettings } from "./schema";

const SWITCH = ["on", "off"] as const;
type Switch = (typeof SWITCH)[number];
function toSwitch(value: boolean | undefined): Switch | undefined {
  if (value === undefined) return undefined;
  return value ? "on" : "off";
}
const fromSwitch = (value: Switch | undefined) => (value === undefined ? undefined : value === "on");
const FIELD_MIN = "220px";

export interface CustomizationFieldsProps {
  value: Partial<CustomizationSettings>;
  /** Report level: the user's values, offered as the "use my settings" choice. Also shows the report-only options. */
  inherited?: CustomizationSettings;
  onChange: (patch: Partial<CustomizationSettings>) => void;
}

/** Toolbar and search behaviour; per report also the summary row and the pinned header. */
export function CustomizationFields({ value, inherited, onChange }: CustomizationFieldsProps) {
  const { t } = useI18n();
  const switchLabel = (option: Switch) => t(`settings.${option}`);
  const minSearch = (
    <NumberField
      label={t("settings.minSearch")}
      value={value.minSearch}
      min={MIN_SEARCH_RANGE.min}
      max={MIN_SEARCH_RANGE.max}
      inherited={inherited?.minSearch}
      // At user level an empty number is invalid (NaN fails validation); at report level it means "inherit".
      onChange={(next) => onChange({ minSearch: next ?? (inherited ? undefined : Number.NaN) })}
    />
  );

  if (!inherited) {
    return (
      <Stack $gap="lg">
        <Checkbox checked={value.toolbarCollapsed ?? false} onChange={(toolbarCollapsed) => onChange({ toolbarCollapsed })}>
          {t("settings.toolbarCollapsed")}
        </Checkbox>
        {minSearch}
      </Stack>
    );
  }

  return (
    <Grid $min={FIELD_MIN}>
      <ChoiceField
        label={t("settings.toolbarCollapsed")}
        value={toSwitch(value.toolbarCollapsed)}
        options={SWITCH}
        optionLabel={switchLabel}
        inherited={toSwitch(inherited.toolbarCollapsed)}
        onChange={(next) => onChange({ toolbarCollapsed: fromSwitch(next) })}
      />
      {minSearch}
      <ChoiceField
        label={t("settings.summaryRowLocation")}
        value={value.summaryRowLocation}
        options={SUMMARY_ROW_LOCATIONS}
        optionLabel={(location) => t(`settings.summaryRow.${location}`)}
        inherited={inherited.summaryRowLocation}
        onChange={(summaryRowLocation) => onChange({ summaryRowLocation })}
      />
      <ChoiceField
        label={t("settings.tableHeaderPinned")}
        value={toSwitch(value.isTableHeaderPinned)}
        options={SWITCH}
        optionLabel={switchLabel}
        inherited={toSwitch(inherited.isTableHeaderPinned)}
        onChange={(next) => onChange({ isTableHeaderPinned: fromSwitch(next) })}
      />
    </Grid>
  );
}
