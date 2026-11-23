"use client";

import { Eraser, Eye, EyeOff, X } from "lucide-react";
import { useId, useMemo } from "react";
import { Badge, Button, Checkbox, Field, Notice, Select, Stack, Text } from "@/components/ui";
import type { FieldDef } from "@/data/types";
import { useReport } from "@/features/report/ReportContext";
import { useI18n } from "@/i18n";
import { countUnconverted } from "./currency";
import { usesRates } from "./engine";
import { isCompareRule, isOperator, offeredOperators, OPERATORS_BY_TYPE, resolveOperator, VALUE_SHAPE, type FilterSpec } from "./operators";
import { Option, RuleCard } from "./parts";
import { cleared, isCleared, isInvalid, isRangeReversed, withOperator } from "./rules";
import type { FilterRatesState } from "./useFilterRates";
import { useFilterText } from "./useFilterText";
import { ValueEditor } from "./ValueEditor";

const ICON_SIZE = 16;

interface FilterCardProps {
  rule: FilterSpec;
  field: FieldDef;
  fields: ReadonlyMap<string, FieldDef>;
  /** FLEX is in effect, so the card offers "Required". */
  flex: boolean;
  ratesState: FilterRatesState;
  onChange: (rule: FilterSpec) => void;
  onRemove: () => void;
}

/** One filter: its on/off, clear and remove actions, the operator, the value editor and its notes. */
export function FilterCard({ rule, field, fields, flex, ratesState, onChange, onRemove }: FilterCardProps) {
  const { t } = useI18n();
  const { rows, format } = useReport();
  const text = useFilterText();
  const titleId = useId();
  const { rates, status, retry } = ratesState;

  const title = text.title(rule);
  const on = rule.enabled !== false;
  const invalid = isInvalid(rule, fields);
  const operator = resolveOperator(rule, field);
  const compare = isCompareRule(rule);
  const locked = rule.period !== undefined;
  // Offered when the field type has "is empty" operators and the current operator is not one of them.
  const canExcludeEmpty = VALUE_SHAPE[operator] !== "null" && (compare || OPERATORS_BY_TYPE[field.type].includes("isNull"));
  const converts = usesRates(rule, field);
  const targetCurrency = rule.currency?.targetCurrency;
  const unconverted = useMemo(
    () => (converts && rates && targetCurrency ? countUnconverted({ rows, field, currency: targetCurrency, rates }) : 0),
    [converts, rates, targetCurrency, rows, field],
  );

  return (
    <RuleCard $off={!on} role="group" aria-labelledby={titleId}>
      <Stack $row $gap="sm" $justify="space-between" $align="start">
        <Stack $row $wrap $gap="xs" $grow>
          <Text $medium id={titleId}>
            {title}
          </Text>
          {on ? null : <Badge>{t("filters.card.off")}</Badge>}
          {flex && rule.mandatory ? <Badge $tone="info">{t("filters.card.required")}</Badge> : null}
          {compare ? <Badge>{t("filters.card.compare")}</Badge> : null}
        </Stack>
        <Stack $row $gap="xs">
          <Button $variant="ghost" $icon aria-pressed={on} aria-label={t("filters.card.toggle", { field: title })} onClick={() => onChange({ ...rule, enabled: !on })}>
            {on ? <Eye size={ICON_SIZE} aria-hidden /> : <EyeOff size={ICON_SIZE} aria-hidden />}
          </Button>
          <Button $variant="ghost" $icon aria-label={t("filters.card.clear", { field: title })} disabled={isCleared(rule)} onClick={() => onChange(cleared(rule, field))}>
            <Eraser size={ICON_SIZE} aria-hidden />
          </Button>
          <Button $variant="ghost" $icon aria-label={t("filters.card.remove", { field: title })} onClick={onRemove}>
            <X size={ICON_SIZE} aria-hidden />
          </Button>
        </Stack>
      </Stack>

      {invalid ? (
        <Notice $tone="warning" role="alert">
          {t("filters.card.invalid")}
        </Notice>
      ) : (
        <>
          <Field label={t("filters.operator")} hint={locked ? t("filters.period.locked") : undefined}>
            {(id) => (
              <Select
                id={id}
                value={operator}
                disabled={locked}
                onChange={(event) => {
                  if (isOperator(event.target.value)) onChange(withOperator({ rule, field, operator: event.target.value }));
                }}
              >
                {offeredOperators(rule, field).map((item) => (
                  <Option key={item} value={item}>
                    {text.operatorLabel(item, field, rule)}
                  </Option>
                ))}
              </Select>
            )}
          </Field>
          <ValueEditor rule={rule} field={field} onChange={onChange} />
          {isRangeReversed(rule, field) ? (
            <Notice $tone="danger" role="alert">
              {t("filters.error.rangeOrder")}
            </Notice>
          ) : null}
          {converts && !rates && status === "error" ? (
            <Notice $tone="danger" role="alert">
              {t("filters.card.ratesError")}
              <Button onClick={retry}>{t("grid.retry")}</Button>
            </Notice>
          ) : null}
          {converts && !rates && status !== "error" ? (
            <Notice $tone="warning" role="status">
              {t("filters.card.ratesLoading")}
            </Notice>
          ) : null}
          {unconverted > 0 ? (
            <Notice $tone="warning" role="status">
              {t("filters.card.unconverted", { count: format.number(unconverted) })}
            </Notice>
          ) : null}
          {canExcludeEmpty ? (
            <Checkbox checked={rule.includeNoValues !== false} onChange={(checked) => onChange({ ...rule, includeNoValues: checked })}>
              {t("filters.card.includeNoValues")}
            </Checkbox>
          ) : null}
          {flex ? (
            <Checkbox checked={rule.mandatory === true} onChange={(checked) => onChange({ ...rule, mandatory: checked })}>
              {t("filters.card.mandatory")}
            </Checkbox>
          ) : null}
        </>
      )}
    </RuleCard>
  );
}
