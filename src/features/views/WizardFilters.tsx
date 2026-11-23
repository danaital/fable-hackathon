"use client";

import { Plus, Trash } from "lucide-react";
import { Button, Card, Checkbox, Input, Select, Stack, Text } from "@/components/ui";
import type { CellValue, FieldDef, ReportDef } from "@/data/types";
import {
  DEFAULT_OPERATOR,
  OPERATORS_BY_TYPE,
  PERIODS_BY_TYPE,
  VALUE_KIND,
  VALUE_SHAPE,
  hasComparison,
  isCompareRule,
  resolveOperator,
  type ValueKind,
} from "@/features/filters/engine";
import { FILTER_RELATIONS, type FilterRule, type ViewState } from "@/features/report/viewState";
import { useI18n } from "@/i18n";
import { OPERATOR_PREFIX, PERIOD_PREFIX } from "./describe";
import { newViewId } from "./model";
import { Fieldset, Legend, Option } from "./parts";

const ICON_SIZE = 16;
const TRUE = "true";
const FALSE = "false";
const LIST_SEPARATOR = ",";
const CUSTOM_DATES = "";
/** The relation selector only matters from two filters up. */
const MIN_FILTERS_FOR_RELATION = 2;
const INPUT_TYPES: Record<ValueKind, string> = {
  text: "text",
  option: "text",
  boolean: "text",
  number: "number",
  date: "date",
  datetime: "datetime-local",
};

/** False while an enabled filter still needs a value; the wizard blocks Next and Done until it has one. */
export function filtersComplete(report: ReportDef, filters: readonly FilterRule[]): boolean {
  return filters.every((rule) => {
    const field = report.fields.find((candidate) => candidate.key === rule.field);
    if (!field || rule.enabled === false || isCompareRule(rule) || rule.period) return true;
    return hasComparison(resolveOperator(rule, field), rule.values);
  });
}

interface ValueInputProps {
  field: FieldDef;
  value: CellValue | undefined;
  label: string;
  onChange: (value: CellValue) => void;
}

function ValueInput({ field, value, label, onChange }: ValueInputProps) {
  const { t, tData } = useI18n();
  const kind = VALUE_KIND[field.type];
  const text = value === null || value === undefined ? "" : String(value);

  if (kind === "boolean") {
    return (
      <Select aria-label={label} value={text} onChange={(event) => onChange(event.target.value === "" ? null : event.target.value === TRUE)}>
        <Option value="">{t("views.wizard.filter.choose")}</Option>
        <Option value={TRUE}>{t("bool.yes")}</Option>
        <Option value={FALSE}>{t("bool.no")}</Option>
      </Select>
    );
  }
  if (field.options) {
    const { options, optionPrefix } = field;
    return (
      <Select aria-label={label} value={text} onChange={(event) => onChange(event.target.value === "" ? null : event.target.value)}>
        <Option value="">{t("views.wizard.filter.choose")}</Option>
        {options.map((option) => (
          <Option key={option} value={option}>
            {optionPrefix ? tData(optionPrefix, option) : option}
          </Option>
        ))}
      </Select>
    );
  }
  const read = (raw: string): CellValue => {
    if (raw === "") return null;
    return kind === "number" ? Number(raw) : raw;
  };
  return <Input aria-label={label} type={INPUT_TYPES[kind]} value={text} onChange={(event) => onChange(read(event.target.value))} />;
}

interface RuleEditorProps {
  report: ReportDef;
  rule: FilterRule;
  onChange: (rule: FilterRule) => void;
  onRemove: () => void;
}

function RuleValues({ rule, field, onChange }: { rule: FilterRule; field: FieldDef; onChange: (rule: FilterRule) => void }) {
  const { t, tData } = useI18n();
  const shape = VALUE_SHAPE[resolveOperator(rule, field)];
  const setValue = (index: number) => (value: CellValue) => {
    const values = [...rule.values];
    values[index] = value;
    onChange({ ...rule, values });
  };

  if (shape === "null") return null;
  if (shape === "single") return <ValueInput field={field} value={rule.values[0]} label={t("views.wizard.filter.value")} onChange={setValue(0)} />;
  if (shape === "list") {
    const { options, optionPrefix } = field;
    if (!options) {
      return (
        <Input
          aria-label={t("views.wizard.filter.list")}
          placeholder={t("views.wizard.filter.list")}
          value={rule.values.join(LIST_SEPARATOR)}
          onChange={(event) => onChange({ ...rule, values: event.target.value.split(LIST_SEPARATOR).map((item) => item.trimStart()) })}
        />
      );
    }
    const toggle = (option: string, checked: boolean) =>
      onChange({ ...rule, values: checked ? [...rule.values, option] : rule.values.filter((value) => value !== option) });
    return (
      <Stack $row $wrap $gap="md" role="group" aria-label={t("views.wizard.filter.value")}>
        {options.map((option) => (
          <Checkbox key={option} checked={rule.values.includes(option)} onChange={(checked) => toggle(option, checked)}>
            {optionPrefix ? tData(optionPrefix, option) : option}
          </Checkbox>
        ))}
      </Stack>
    );
  }

  const isDate = VALUE_KIND[field.type] === "date" || VALUE_KIND[field.type] === "datetime";
  return (
    <>
      {isDate ? (
        <Select
          aria-label={t("views.wizard.filter.period")}
          value={rule.period ?? CUSTOM_DATES}
          onChange={(event) => onChange({ ...rule, period: event.target.value || undefined, values: [] })}
        >
          <Option value={CUSTOM_DATES}>{t("views.wizard.filter.customDates")}</Option>
          {(PERIODS_BY_TYPE[field.type] ?? []).map((period) => (
            <Option key={period} value={period}>
              {tData(PERIOD_PREFIX, period)}
            </Option>
          ))}
        </Select>
      ) : null}
      {rule.period ? null : (
        <>
          <ValueInput field={field} value={rule.values[0]} label={t("views.wizard.filter.from")} onChange={setValue(0)} />
          <ValueInput field={field} value={rule.values[1]} label={t("views.wizard.filter.to")} onChange={setValue(1)} />
        </>
      )}
    </>
  );
}

function RuleEditor({ report, rule, onChange, onRemove }: RuleEditorProps) {
  const { t, tData } = useI18n();
  const field = report.fields.find((candidate) => candidate.key === rule.field);
  const fieldLabel = field ? t(field.labelKey) : rule.field;
  // Field-to-field rules (copied from another view) are kept as they are: they can be switched off or removed here.
  const editable = field !== undefined && !isCompareRule(rule);

  const setField = (key: string) => {
    const next = report.fields.find((candidate) => candidate.key === key);
    if (next) onChange({ id: rule.id, field: key, operator: DEFAULT_OPERATOR[next.type], values: [], enabled: rule.enabled });
  };

  return (
    <Card>
      <Stack $gap="sm">
        <Stack $row $wrap $gap="sm">
          {editable ? (
            <>
              <Select aria-label={t("views.wizard.filter.field")} value={rule.field} onChange={(event) => setField(event.target.value)}>
                {report.fields.map((candidate) => (
                  <Option key={candidate.key} value={candidate.key}>
                    {t(candidate.labelKey)}
                  </Option>
                ))}
              </Select>
              <Select
                aria-label={t("views.wizard.filter.operator")}
                value={resolveOperator(rule, field)}
                onChange={(event) => onChange({ ...rule, operator: event.target.value, values: [], period: undefined })}
              >
                {OPERATORS_BY_TYPE[field.type].map((operator) => (
                  <Option key={operator} value={operator}>
                    {tData(OPERATOR_PREFIX, operator)}
                  </Option>
                ))}
              </Select>
              <RuleValues rule={rule} field={field} onChange={onChange} />
            </>
          ) : (
            <Text $size="sm">{t("views.wizard.filter.fixed", { field: fieldLabel })}</Text>
          )}
        </Stack>
        <Stack $row $wrap $gap="md" $justify="space-between">
          <Checkbox checked={rule.enabled !== false} onChange={(enabled) => onChange({ ...rule, enabled })}>
            {t("views.wizard.filter.enabled")}
          </Checkbox>
          <Button aria-label={t("views.wizard.filter.remove", { field: fieldLabel })} onClick={onRemove}>
            <Trash size={ICON_SIZE} aria-hidden />
            {t("action.remove")}
          </Button>
        </Stack>
      </Stack>
    </Card>
  );
}

interface Props {
  report: ReportDef;
  state: ViewState;
  onChange: (patch: Partial<ViewState>) => void;
}

/** Wizard editor for a view's filters: field-to-value rules, how they combine, and which are switched on. */
export function WizardFilters({ report, state, onChange }: Props) {
  const { t } = useI18n();
  const { filters, relation } = state;
  const first = report.fields[0];

  const replace = (index: number, rule: FilterRule) => onChange({ filters: filters.map((other, at) => (at === index ? rule : other)) });
  const add = () =>
    onChange({ filters: [...filters, { id: newViewId(), field: first.key, operator: DEFAULT_OPERATOR[first.type], values: [] }] });
  // "flex" needs per-filter roles that only the filter toolbar edits; it stays selectable when a copied view already uses it.
  const relations = FILTER_RELATIONS.filter((option) => option !== "flex" || relation === "flex");

  return (
    <Fieldset>
      <Legend>{t("views.wizard.filters")}</Legend>
      <Text $muted $size="sm">
        {t("views.wizard.filtersHint")}
      </Text>
      {filters.map((rule, index) => (
        <RuleEditor
          key={rule.id}
          report={report}
          rule={rule}
          onChange={(next) => replace(index, next)}
          onRemove={() => onChange({ filters: filters.filter((_, at) => at !== index) })}
        />
      ))}
      {filtersComplete(report, filters) ? null : (
        <Text $size="sm" role="alert">
          {t("views.wizard.filtersIncomplete")}
        </Text>
      )}
      <Stack $row $wrap $gap="md">
        <Button onClick={add}>
          <Plus size={ICON_SIZE} aria-hidden />
          {t("views.wizard.filter.add")}
        </Button>
        <Select
          aria-label={t("views.wizard.relation")}
          value={relation}
          disabled={filters.length < MIN_FILTERS_FOR_RELATION}
          onChange={(event) => onChange({ relation: FILTER_RELATIONS.find((option) => option === event.target.value) ?? relation })}
        >
          {relations.map((option) => (
            <Option key={option} value={option}>
              {t(`views.relation.${option}`)}
            </Option>
          ))}
        </Select>
      </Stack>
    </Fieldset>
  );
}
