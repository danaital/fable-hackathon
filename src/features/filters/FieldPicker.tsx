"use client";

import { useId, useState } from "react";
import { Button, Checkbox, Chip, Dialog, Divider, Field, Grid, Heading, Input, Notice, Select, Stack, Text } from "@/components/ui";
import type { FieldDef } from "@/data/types";
import { useI18n, type I18nKey } from "@/i18n";
import { FIELD_OPERATORS_BY_TYPE, isCompareRule, isFieldOperator, VALUE_KIND, type FilterSpec, type ValueKind } from "./operators";
import { GroupLabel, Option } from "./parts";
import { createCompareRule, createRule, sameCompare } from "./rules";
import { useFilterText } from "./useFilterText";

// A date can be compared with a date-time; every other field compares with fields of its own kind.
const FAMILY: Record<ValueKind, string> = { text: "text", number: "number", boolean: "boolean", option: "option", date: "date", datetime: "date" };
const family = (field: FieldDef) => FAMILY[VALUE_KIND[field.type]];

interface FieldPickerProps {
  open: boolean;
  onClose: () => void;
  fields: readonly FieldDef[];
  /** Keys of the columns the table shows now; they are listed first. */
  visibleKeys: readonly string[];
  rules: readonly FilterSpec[];
  onApply: (rules: FilterSpec[]) => void;
}

interface FieldGroupProps {
  labelKey: I18nKey;
  fields: readonly FieldDef[];
  checked: ReadonlySet<string>;
  onToggle: (key: string, checked: boolean) => void;
}

function FieldGroup({ labelKey, fields, checked, onToggle }: FieldGroupProps) {
  const { t } = useI18n();
  const labelId = useId();
  if (fields.length === 0) return null;
  return (
    <Stack $gap="xs" role="group" aria-labelledby={labelId}>
      <GroupLabel id={labelId}>{t(labelKey)}</GroupLabel>
      {fields.map((field) => (
        <Checkbox key={field.key} checked={checked.has(field.key)} onChange={(value) => onToggle(field.key, value)}>
          {t(field.labelKey)}
        </Checkbox>
      ))}
    </Stack>
  );
}

/**
 * Choose which fields have a filter (tick to add, untick to remove) and which pairs of fields are compared.
 * Nothing changes until Apply. The parent remounts this with a new `key` on each opening, so it starts from the current filters.
 */
export function FieldPicker({ open, onClose, fields, visibleKeys, rules, onApply }: FieldPickerProps) {
  const { t } = useI18n();
  const text = useFilterText();
  const [checked, setChecked] = useState<ReadonlySet<string>>(() => new Set(rules.filter((rule) => !isCompareRule(rule)).map((rule) => rule.field)));
  const [pairs, setPairs] = useState<readonly FilterSpec[]>(() => rules.filter(isCompareRule));
  const [term, setTerm] = useState("");
  const [fieldA, setFieldA] = useState("");
  const [fieldOperator, setFieldOperator] = useState("");
  const [fieldB, setFieldB] = useState("");
  const [error, setError] = useState<I18nKey | null>(null);

  const needle = term.trim().toLowerCase();
  const matching = fields.filter((field) => t(field.labelKey).toLowerCase().includes(needle));
  const visible = matching.filter((field) => visibleKeys.includes(field.key));
  const hidden = matching.filter((field) => !visibleKeys.includes(field.key));
  const first = fields.find((field) => field.key === fieldA);
  const partners = first ? fields.filter((field) => field.key !== first.key && family(field) === family(first)) : [];

  const toggle = (key: string, value: boolean) => {
    const next = new Set(checked);
    if (value) next.add(key);
    else next.delete(key);
    setChecked(next);
  };

  const addPair = () => {
    if (!first || !isFieldOperator(fieldOperator) || !partners.some((field) => field.key === fieldB)) return setError("filters.error.compareIncomplete");
    const pair = { field: fieldA, fieldOperator, compareField: fieldB };
    if (pairs.some((rule) => sameCompare(rule, pair))) return setError("filters.error.compareDuplicate");
    setPairs([...pairs, createCompareRule(pair)]);
    setFieldB("");
    setError(null);
  };

  const apply = () => {
    const kept = rules.filter((rule) => (isCompareRule(rule) ? pairs.includes(rule) : checked.has(rule.field)));
    const filtered = new Set(kept.filter((rule) => !isCompareRule(rule)).map((rule) => rule.field));
    const added = fields.filter((field) => checked.has(field.key) && !filtered.has(field.key)).map(createRule);
    onApply([...kept, ...added, ...pairs.filter((rule) => !rules.includes(rule))]);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("filters.picker.title")}
      $wide
      footer={
        <>
          <Button onClick={onClose}>{t("action.cancel")}</Button>
          <Button $variant="primary" onClick={apply}>
            {t("action.apply")}
          </Button>
        </>
      }
    >
      <Grid $min="300px">
        <Stack $gap="md">
          <Heading as="h3" $size="md">
            {t("filters.picker.byValue")}
          </Heading>
          <Input type="search" value={term} aria-label={t("filters.picker.search")} placeholder={t("filters.picker.search")} onChange={(event) => setTerm(event.target.value)} />
          <FieldGroup labelKey="filters.picker.visible" fields={visible} checked={checked} onToggle={toggle} />
          <FieldGroup labelKey="filters.picker.hidden" fields={hidden} checked={checked} onToggle={toggle} />
          {matching.length === 0 ? (
            <Text $muted $size="sm" role="status">
              {t("filters.picker.noFields")}
            </Text>
          ) : null}
        </Stack>

        <Stack $gap="md">
          <Heading as="h3" $size="md">
            {t("filters.picker.compare")}
          </Heading>
          <Field label={t("filters.picker.fieldA")}>
            {(id) => (
              <Select
                id={id}
                value={fieldA}
                onChange={(event) => {
                  setFieldA(event.target.value);
                  setFieldOperator("");
                  setFieldB("");
                }}
              >
                <Option value="">{t("filters.picker.choose")}</Option>
                {fields.map((field) => (
                  <Option key={field.key} value={field.key}>
                    {t(field.labelKey)}
                  </Option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={t("filters.picker.fieldOperator")}>
            {(id) => (
              <Select id={id} value={fieldOperator} disabled={!first} onChange={(event) => setFieldOperator(event.target.value)}>
                <Option value="">{t("filters.picker.choose")}</Option>
                {(first ? FIELD_OPERATORS_BY_TYPE[first.type] : []).map((operator) => (
                  <Option key={operator} value={operator}>
                    {t(`filters.fieldOp.${operator}`)}
                  </Option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={t("filters.picker.fieldB")}>
            {(id) => (
              <Select id={id} value={fieldB} disabled={!first} onChange={(event) => setFieldB(event.target.value)}>
                <Option value="">{t("filters.picker.choose")}</Option>
                {partners.map((field) => (
                  <Option key={field.key} value={field.key}>
                    {t(field.labelKey)}
                  </Option>
                ))}
              </Select>
            )}
          </Field>
          {error ? (
            <Notice $tone="danger" role="alert">
              {t(error)}
            </Notice>
          ) : null}
          <Button onClick={addPair}>{t("filters.picker.addCompare")}</Button>
          {pairs.length > 0 ? <Divider /> : null}
          <Stack $row $wrap $gap="sm">
            {pairs.map((rule) => (
              <Chip key={rule.id} removeLabel={t("filters.picker.removePair", { name: text.title(rule) })} onRemove={() => setPairs(pairs.filter((item) => item !== rule))}>
                {text.title(rule)}
              </Chip>
            ))}
          </Stack>
        </Stack>
      </Grid>
    </Dialog>
  );
}
