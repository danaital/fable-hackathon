"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { Button, Field, Notice, Select, Stack, Text } from "@/components/ui";
import {
  FIELD_OPERATORS_BY_TYPE,
  MIN_FILTERS_FOR_FLEX,
  VALUE_KIND,
  applyFilters,
  effectiveRelation,
  type FilterSpec,
} from "@/features/filters/engine";
import { createCompareRule, createRule } from "@/features/filters/rules";
import { FILTER_RELATIONS } from "@/features/report/viewState";
import { useI18n } from "@/i18n";
import { FilterChips } from "../DefinitionSummary";
import { resolveRules } from "../plan";
import { RULE_SOURCES, type DataSource, type RuleSource } from "../schema";
import { ChoiceCards, Fieldset, ICON_SIZE, Legend, Option, pickOption } from "../ui";
import { FilterCard } from "./FilterCard";
import type { StepProps } from "./types";

const MIN_FILTERS_FOR_RELATION = 2;
const NOT_PICKED = "";

/** The three places a part of the export (filters or sorts) can come from, as option cards. */
export function useRuleSourceChoices(dataSource: DataSource) {
  const { t } = useI18n();
  return RULE_SOURCES.map((source: RuleSource) => ({
    value: source,
    title: t(`export.ruleSource.${source}`),
    description: t(`export.ruleSource.${source}.desc`),
    // The custom data source has no view or template to take anything from.
    disabled: source === "from_view" && dataSource === "custom",
  }));
}

export function FiltersStep({ state, dispatch, page }: StepProps) {
  const { t } = useI18n();
  const { fields } = page.report;
  const sourceChoices = useRuleSourceChoices(state.source);
  const [fieldKey, setFieldKey] = useState(NOT_PICKED);
  const [compareA, setCompareA] = useState(NOT_PICKED);
  const [compareB, setCompareB] = useState(NOT_PICKED);

  const rules = resolveRules(state, page);
  const isCustom = state.filtersSource === "custom";
  const filters: readonly FilterSpec[] = rules.filters;
  const active = filters.filter((rule) => rule.enabled !== false);
  // shortcut: counted on every render; memoize once reports hold far more than a few thousand rows.
  const matching = (rules.liveFilters ? page.filteredRows : applyFilters({ rows: page.rows, filters: rules.filters, relation: rules.relation, fields })).length;

  const setFilters = (next: FilterSpec[]) => dispatch({ type: "patch", patch: { customFilters: next } });
  const fieldA = fields.find((field) => field.key === compareA);
  // A field can be compared with another field that holds the same kind of value.
  const compatible = fieldA ? fields.filter((field) => field.key !== fieldA.key && VALUE_KIND[field.type] === VALUE_KIND[fieldA.type]) : [];

  const addFilter = () => {
    const field = fields.find((candidate) => candidate.key === fieldKey);
    if (field) setFilters([...state.customFilters, createRule(field)]);
    setFieldKey(NOT_PICKED);
  };
  const addCompare = () => {
    if (!fieldA || !compareB) return;
    setFilters([...state.customFilters, createCompareRule({ field: fieldA.key, fieldOperator: FIELD_OPERATORS_BY_TYPE[fieldA.type][0], compareField: compareB })]);
    setCompareB(NOT_PICKED);
  };

  return (
    <>
      <ChoiceCards
        legend={t("export.filters.source")}
        name="export-filters-source"
        value={state.filtersSource}
        options={sourceChoices}
        onChange={(source) => dispatch({ type: "setFiltersSource", source })}
      />
      <Text $size="sm" role="status">
        {t("export.filters.counts", { matching, total: page.rows.length, filters: active.length })}
      </Text>

      <Field
        label={t("export.filters.relation")}
        hint={filters.length < MIN_FILTERS_FOR_RELATION ? t("export.filters.relationNeedsTwo") : t(`export.relation.${effectiveRelation(filters, rules.relation)}.hint`)}
      >
        {(id) => (
          <Select
            id={id}
            value={rules.relation}
            disabled={!isCustom || filters.length < MIN_FILTERS_FOR_RELATION}
            onChange={(event) => dispatch({ type: "patch", patch: { filterRelation: pickOption(FILTER_RELATIONS, event.target.value, state.filterRelation) } })}
          >
            {FILTER_RELATIONS.map((relation) => (
              // FLEX cannot work with fewer than three filters that are on, so it is not offered until then.
              <Option key={relation} value={relation} disabled={relation === "flex" && active.length < MIN_FILTERS_FOR_FLEX}>
                {t(`export.relation.${relation}`)}
              </Option>
            ))}
          </Select>
        )}
      </Field>

      {isCustom ? (
        <>
          {state.customFilters.map((rule, index) => (
            <FilterCard
              key={rule.id}
              rule={rule}
              fields={fields}
              rows={page.rows}
              showRequired={state.filterRelation === "flex"}
              onChange={(next) => setFilters(state.customFilters.map((other, at) => (at === index ? next : other)))}
              onRemove={() => setFilters(state.customFilters.filter((_, at) => at !== index))}
            />
          ))}
          {state.customFilters.length === 0 ? <Notice>{t("export.filters.empty")}</Notice> : null}
          <Fieldset>
            <Legend>{t("export.filters.addValue")}</Legend>
            <Stack $row $wrap $gap="sm" $align="end">
              <Field label={t("export.filters.field")}>
                {(id) => (
                  <Select id={id} value={fieldKey} onChange={(event) => setFieldKey(event.target.value)}>
                    <Option value={NOT_PICKED}>{t("export.chooseField")}</Option>
                    {fields.map((field) => (
                      <Option key={field.key} value={field.key}>
                        {t(field.labelKey)}
                      </Option>
                    ))}
                  </Select>
                )}
              </Field>
              <Button disabled={!fieldKey} onClick={addFilter}>
                <Plus size={ICON_SIZE} aria-hidden />
                {t("export.filters.add")}
              </Button>
            </Stack>
          </Fieldset>
          <Fieldset>
            <Legend>{t("export.filters.addCompare")}</Legend>
            <Stack $row $wrap $gap="sm" $align="end">
              <Field label={t("export.filters.compareA")}>
                {(id) => (
                  <Select
                    id={id}
                    value={compareA}
                    onChange={(event) => {
                      setCompareA(event.target.value);
                      setCompareB(NOT_PICKED);
                    }}
                  >
                    <Option value={NOT_PICKED}>{t("export.chooseField")}</Option>
                    {fields.map((field) => (
                      <Option key={field.key} value={field.key}>
                        {t(field.labelKey)}
                      </Option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label={t("export.filters.compareB")}>
                {(id) => (
                  <Select id={id} value={compareB} disabled={compatible.length === 0} onChange={(event) => setCompareB(event.target.value)}>
                    <Option value={NOT_PICKED}>{t("export.chooseField")}</Option>
                    {compatible.map((field) => (
                      <Option key={field.key} value={field.key}>
                        {t(field.labelKey)}
                      </Option>
                    ))}
                  </Select>
                )}
              </Field>
              <Button disabled={!compareB} onClick={addCompare}>
                <Plus size={ICON_SIZE} aria-hidden />
                {t("export.filters.add")}
              </Button>
            </Stack>
          </Fieldset>
        </>
      ) : (
        <Stack $gap="sm">
          <Text $muted $size="sm">
            {t("export.filters.readOnly")}
          </Text>
          <FilterChips filters={filters} fields={fields} />
          {rules.liveFilters && page.view.search.trim() ? (
            <Text $size="sm">{t("export.filters.search", { term: page.view.search.trim() })}</Text>
          ) : null}
        </Stack>
      )}
    </>
  );
}
