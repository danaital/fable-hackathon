"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { Badge, Button, Field, Ltr, Notice, Select, Stack, Text } from "@/components/ui";
import type { SortDirection, SortRule } from "@/features/grid/sort";
import { useI18n } from "@/i18n";
import { SortChips } from "../DefinitionSummary";
import { resolveRules } from "../plan";
import { ChoiceCards, ICON_SIZE, ListRow, Option, RowActions, moveItem, pickOption } from "../ui";
import { useRuleSourceChoices } from "./FiltersStep";
import type { StepProps } from "./types";

const DIRECTIONS: readonly SortDirection[] = ["asc", "desc"];
const NOT_PICKED = "";

export function SortStep({ state, dispatch, page }: StepProps) {
  const { t } = useI18n();
  const { fields } = page.report;
  const sourceChoices = useRuleSourceChoices(state.source);
  const [fieldKey, setFieldKey] = useState(NOT_PICKED);
  const shown = resolveRules(state, page).sorts;
  // A sort on a field the report no longer has stays stored but is not shown or numbered.
  const known = state.customSorts.filter((rule) => fields.some((field) => field.key === rule.key));
  const unsorted = fields.filter((field) => !state.customSorts.some((rule) => rule.key === field.key));

  const setSorts = (sorts: SortRule[]) => dispatch({ type: "patch", patch: { customSorts: sorts } });
  const add = () => {
    if (fieldKey) setSorts([...state.customSorts, { key: fieldKey, direction: "asc" }]);
    setFieldKey(NOT_PICKED);
  };

  return (
    <>
      <ChoiceCards
        legend={t("export.sort.source")}
        name="export-sorts-source"
        value={state.sortsSource}
        options={sourceChoices}
        onChange={(source) => dispatch({ type: "setSortsSource", source, shown })}
      />
      {state.sortsSource === "custom" ? (
        <>
          {known.length === 0 ? <Notice>{t("export.sort.empty")}</Notice> : null}
          {known.map((rule, index) => {
            const field = fields.find((candidate) => candidate.key === rule.key);
            const name = field ? t(field.labelKey) : rule.key;
            return (
              <ListRow key={rule.key}>
                <Stack $row $wrap $gap="sm">
                  <Badge $tone="info" title={t("export.sort.priority", { n: index + 1 })}>
                    <Ltr>{index + 1}</Ltr>
                  </Badge>
                  <Text $size="sm">{name}</Text>
                  <Select
                    aria-label={t("export.sort.direction", { name })}
                    value={rule.direction}
                    onChange={(event) =>
                      setSorts(known.map((other) => (other.key === rule.key ? { ...other, direction: pickOption(DIRECTIONS, event.target.value, other.direction) } : other)))
                    }
                  >
                    {DIRECTIONS.map((direction) => (
                      <Option key={direction} value={direction}>
                        {t(`export.sort.${direction}`)}
                      </Option>
                    ))}
                  </Select>
                </Stack>
                <RowActions
                  name={name}
                  onUp={index > 0 ? () => setSorts(moveItem(known, index, -1)) : undefined}
                  onDown={index < known.length - 1 ? () => setSorts(moveItem(known, index, 1)) : undefined}
                  onRemove={() => setSorts(known.filter((other) => other.key !== rule.key))}
                />
              </ListRow>
            );
          })}
          <Stack $row $wrap $gap="sm" $align="end">
            <Field label={t("export.sort.addField")}>
              {(id) => (
                <Select id={id} value={fieldKey} onChange={(event) => setFieldKey(event.target.value)}>
                  <Option value={NOT_PICKED}>{t("export.chooseField")}</Option>
                  {unsorted.map((field) => (
                    <Option key={field.key} value={field.key}>
                      {t(field.labelKey)}
                    </Option>
                  ))}
                </Select>
              )}
            </Field>
            <Button disabled={!fieldKey} onClick={add}>
              <Plus size={ICON_SIZE} aria-hidden />
              {t("export.sort.add")}
            </Button>
          </Stack>
        </>
      ) : (
        <Stack $gap="sm">
          <Text $muted $size="sm">
            {t("export.sort.readOnly")}
          </Text>
          <SortChips sorts={shown} fields={fields} />
        </Stack>
      )}
    </>
  );
}
