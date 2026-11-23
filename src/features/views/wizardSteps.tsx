"use client";

import { ArrowDown, ArrowUp, Plus, Trash } from "lucide-react";
import { Badge, Button, Checkbox, Grid, Label, Ltr, Select, Stack, Text } from "@/components/ui";
import type { ReportDef } from "@/data/types";
import { anchorKeys } from "@/features/grid/columns";
import { ALL_OPTION, DEFAULT_SIZE_OPTIONS, toOption, toPageSize } from "@/features/grid/paging";
import { GROUPABLE_TYPES } from "@/features/grid/prepare";
import { isAggregate, totalOptions } from "@/features/grid/totals";
import { AGGREGATES, type ViewState } from "@/features/report/viewState";
import { useSummaryConfig } from "@/features/summary/summaryConfig";
import { useI18n } from "@/i18n";
import { moveItem } from "./logic";
import { SORT_DIRECTIONS } from "./model";
import { Fieldset, Legend, Option } from "./parts";

const ICON_SIZE = 16;
const NO_TOTAL = "";

export interface StepProps {
  report: ReportDef;
  state: ViewState;
  onChange: (patch: Partial<ViewState>) => void;
}

interface MoveButtonsProps {
  name: string;
  index: number;
  count: number;
  onMove: (delta: -1 | 1) => void;
}

/** Keyboard reordering: one place up or down. */
function MoveButtons({ name, index, count, onMove }: MoveButtonsProps) {
  const { t } = useI18n();
  return (
    <>
      <Button $icon aria-label={t("views.wizard.moveUp", { name })} disabled={index === 0} onClick={() => onMove(-1)}>
        <ArrowUp size={ICON_SIZE} aria-hidden />
      </Button>
      <Button $icon aria-label={t("views.wizard.moveDown", { name })} disabled={index === count - 1} onClick={() => onMove(1)}>
        <ArrowDown size={ICON_SIZE} aria-hidden />
      </Button>
    </>
  );
}

/** Which fields show as columns, and in what order. The report's anchor column always shows. */
export function WizardColumns({ report, state, onChange }: StepProps) {
  const { t } = useI18n();
  const { columns } = state;
  const anchors = new Set(anchorKeys(report.fields));
  const label = (key: string) => {
    const field = report.fields.find((candidate) => candidate.key === key);
    return field ? t(field.labelKey) : key;
  };
  const hidden = report.fields.filter((field) => !columns.includes(field.key));

  return (
    <Fieldset>
      <Legend>{t("views.wizard.columns")}</Legend>
      <Stack $row $wrap $gap="md">
        <Text $muted $size="sm" role="status">
          {t("views.wizard.selectedCount", { count: columns.length, total: report.fields.length })}
        </Text>
        <Button onClick={() => onChange({ columns: [...columns, ...hidden.map((field) => field.key)] })}>{t("views.wizard.selectAll")}</Button>
        <Button onClick={() => onChange({ columns: columns.filter((key) => anchors.has(key)) })}>{t("views.wizard.deselectAll")}</Button>
      </Stack>
      {columns.length === 0 ? (
        <Text $size="sm" role="alert">
          {t("views.wizard.columnsRequired")}
        </Text>
      ) : null}
      {columns.map((key, index) => (
        <Stack key={key} $row $gap="sm" $justify="space-between">
          <Checkbox checked disabled={anchors.has(key)} onChange={() => onChange({ columns: columns.filter((other) => other !== key) })}>
            {anchors.has(key) ? t("views.wizard.anchor", { name: label(key) }) : label(key)}
          </Checkbox>
          <Stack $row $gap="xs">
            <MoveButtons
              name={label(key)}
              index={index}
              count={columns.length}
              onMove={(delta) => onChange({ columns: moveItem({ items: columns, index, delta }) })}
            />
          </Stack>
        </Stack>
      ))}
      {hidden.map((field) => (
        <Checkbox key={field.key} checked={false} onChange={() => onChange({ columns: [...columns, field.key] })}>
          {t(field.labelKey)}
        </Checkbox>
      ))}
    </Fieldset>
  );
}

/** Sort rules in priority order. New rules start ascending. */
export function WizardSorts({ report, state, onChange }: StepProps) {
  const { t } = useI18n();
  const { sorts } = state;
  const unused = report.fields.filter((field) => !sorts.some((rule) => rule.key === field.key));
  const replace = (index: number, patch: Partial<ViewState["sorts"][number]>) =>
    onChange({ sorts: sorts.map((rule, at) => (at === index ? { ...rule, ...patch } : rule)) });

  return (
    <Fieldset>
      <Legend>{t("views.wizard.sorts")}</Legend>
      {sorts.map((rule, index) => {
        const field = report.fields.find((candidate) => candidate.key === rule.key);
        const name = field ? t(field.labelKey) : rule.key;
        return (
          <Stack key={rule.key} $row $wrap $gap="sm">
            <Badge $tone="info" title={t("views.wizard.sortPriority", { n: index + 1 })}>
              <Ltr>{index + 1}</Ltr>
            </Badge>
            <Select aria-label={t("views.wizard.sortField", { n: index + 1 })} value={rule.key} onChange={(event) => replace(index, { key: event.target.value })}>
              {[...(field ? [field] : []), ...unused].map((candidate) => (
                <Option key={candidate.key} value={candidate.key}>
                  {t(candidate.labelKey)}
                </Option>
              ))}
            </Select>
            <Select
              aria-label={t("views.wizard.sortDirection", { name })}
              value={rule.direction}
              onChange={(event) => replace(index, { direction: SORT_DIRECTIONS.find((direction) => direction === event.target.value) ?? rule.direction })}
            >
              {SORT_DIRECTIONS.map((direction) => (
                <Option key={direction} value={direction}>
                  {t(`views.direction.${direction}`)}
                </Option>
              ))}
            </Select>
            <MoveButtons name={name} index={index} count={sorts.length} onMove={(delta) => onChange({ sorts: moveItem({ items: sorts, index, delta }) })} />
            <Button $icon aria-label={t("views.wizard.sortRemove", { name })} onClick={() => onChange({ sorts: sorts.filter((_, at) => at !== index) })}>
              <Trash size={ICON_SIZE} aria-hidden />
            </Button>
          </Stack>
        );
      })}
      <Stack $row>
        <Button disabled={unused.length === 0} onClick={() => onChange({ sorts: [...sorts, { key: unused[0].key, direction: "asc" }] })}>
          <Plus size={ICON_SIZE} aria-hidden />
          {t("views.wizard.sortAdd")}
        </Button>
      </Stack>
    </Fieldset>
  );
}

interface VisibilityProps {
  legend: string;
  items: readonly { id: string; title: string }[];
  /** `null` follows the report's defaults (everything); a list shows exactly those. */
  value: string[] | null;
  onChange: (value: string[] | null) => void;
}

/** Which widgets or charts the view shows. Selecting everything stores "follow the report", so later additions show too. */
function VisibilityPicker({ legend, items, value, onChange }: VisibilityProps) {
  const { t } = useI18n();
  const shown = items.filter((item) => value === null || value.includes(item.id)).map((item) => item.id);
  const toggle = (id: string, checked: boolean) => {
    const next = items.map((item) => item.id).filter((other) => (other === id ? checked : shown.includes(other)));
    onChange(next.length === items.length ? null : next);
  };

  return (
    <Fieldset>
      <Legend>{legend}</Legend>
      <Stack $row $wrap $gap="md">
        <Text $muted $size="sm" role="status">
          {t("views.wizard.selectedCount", { count: shown.length, total: items.length })}
        </Text>
        <Button onClick={() => onChange(null)}>{t("views.wizard.selectAll")}</Button>
        <Button onClick={() => onChange([])}>{t("views.wizard.deselectAll")}</Button>
      </Stack>
      {items.map((item) => (
        <Checkbox key={item.id} checked={shown.includes(item.id)} onChange={(checked) => toggle(item.id, checked)}>
          {item.title}
        </Checkbox>
      ))}
    </Fieldset>
  );
}

/** Totals row, grouping, rows per page, and widget and chart visibility. */
export function WizardPage({ report, state, onChange }: StepProps) {
  const { t, locale } = useI18n();
  const config = useSummaryConfig(report.id);
  const titled = (items: readonly { id: string; title: Record<typeof locale, string> }[]) =>
    items.map((item) => ({ id: item.id, title: item.title[locale] }));
  const { totals, groupBy } = state;
  const shown = state.columns.flatMap((key) => report.fields.find((field) => field.key === key) ?? []);
  const groupable = report.fields.filter((field) => GROUPABLE_TYPES.has(field.type));

  const setTotal = (key: string, value: string) => {
    const aggregate = AGGREGATES.find((option) => option === value);
    const rest = Object.fromEntries(Object.entries(totals).filter(([other]) => other !== key));
    onChange({ totals: aggregate ? { ...rest, [key]: aggregate } : rest });
  };
  const toggleGroup = (key: string, checked: boolean) => onChange({ groupBy: checked ? [...groupBy, key] : groupBy.filter((other) => other !== key) });

  return (
    <Stack $gap="xl">
      <Fieldset>
        <Legend>{t("views.wizard.totals")}</Legend>
        <Grid $min="200px">
          {shown.map((field) => {
            const options = totalOptions(field.type).filter(isAggregate);
            return options.length > 0 ? (
              <Label key={field.key}>
                {t(field.labelKey)}
                <Select value={totals[field.key] ?? NO_TOTAL} onChange={(event) => setTotal(field.key, event.target.value)}>
                  <Option value={NO_TOTAL}>{t("views.wizard.noTotal")}</Option>
                  {options.map((option) => (
                    <Option key={option} value={option}>
                      {t(`views.aggregate.${option}`)}
                    </Option>
                  ))}
                </Select>
              </Label>
            ) : null;
          })}
        </Grid>
      </Fieldset>

      <Fieldset>
        <Legend>{t("views.wizard.grouping")}</Legend>
        <Stack $row $wrap $gap="md">
          {groupable.map((field) => {
            const level = groupBy.indexOf(field.key) + 1;
            return (
              <Checkbox key={field.key} checked={level > 0} onChange={(checked) => toggleGroup(field.key, checked)}>
                {level > 0 ? t("views.preview.level", { n: level, field: t(field.labelKey) }) : t(field.labelKey)}
              </Checkbox>
            );
          })}
        </Stack>
      </Fieldset>

      <Label>
        {t("views.wizard.pageSize")}
        <Select value={toOption(state.pageSize)} onChange={(event) => onChange({ pageSize: toPageSize(Number(event.target.value)) })}>
          {DEFAULT_SIZE_OPTIONS.map((option) => (
            <Option key={option} value={option}>
              {option === ALL_OPTION ? t("views.wizard.pageSizeAll") : option}
            </Option>
          ))}
        </Select>
      </Label>

      <VisibilityPicker
        legend={t("views.preview.widgets")}
        items={titled(config.widgets)}
        value={state.widgets}
        onChange={(widgets) => onChange({ widgets })}
      />
      <VisibilityPicker legend={t("views.preview.charts")} items={titled(config.charts)} value={state.charts} onChange={(charts) => onChange({ charts })} />
    </Stack>
  );
}
