"use client";

import { useId } from "react";
import { Radio, Stack, Text } from "@/components/ui";
import { FILTER_RELATIONS, type FilterRelation, type FilterRule } from "@/features/report/viewState";
import { useI18n } from "@/i18n";
import { effectiveRelation, MIN_FILTERS_FOR_FLEX } from "./engine";
import { RelationBox } from "./parts";

const MIN_FILTERS_FOR_RELATION = 2;
/** How many filters must be on before each relation can be chosen. */
const MINIMUM: Record<FilterRelation, number> = { and: MIN_FILTERS_FOR_RELATION, or: MIN_FILTERS_FOR_RELATION, flex: MIN_FILTERS_FOR_FLEX };

interface RelationSelectorProps {
  filters: readonly FilterRule[];
  relation: FilterRelation;
  onChange: (relation: FilterRelation) => void;
}

/** AND / OR / FLEX. Always shows the relation that is really applied, and says why a choice is not available. */
export function RelationSelector({ filters, relation, onChange }: RelationSelectorProps) {
  const { t } = useI18n();
  const labelId = useId();
  const hintId = useId();
  const groupName = useId();

  const on = filters.filter((rule) => rule.enabled !== false).length;
  const applied = effectiveRelation(filters, relation);

  return (
    <RelationBox role="radiogroup" aria-labelledby={labelId} aria-describedby={hintId}>
      <Stack $row $wrap $gap="lg">
        <Text $medium id={labelId}>
          {t("filters.relation.label")}
        </Text>
        {FILTER_RELATIONS.map((option) => (
          <Radio key={option} name={groupName} checked={applied === option} disabled={on < MINIMUM[option]} onChange={() => onChange(option)}>
            {t(`filters.relation.${option}`)}
          </Radio>
        ))}
      </Stack>
      <Stack $gap="xs" id={hintId}>
        <Text $muted $size="sm">
          {on < MIN_FILTERS_FOR_RELATION ? t("filters.relation.needTwo") : t(`filters.relation.hint.${applied}`)}
        </Text>
        {on >= MIN_FILTERS_FOR_RELATION && on < MIN_FILTERS_FOR_FLEX ? (
          <Text $muted $size="sm">
            {t("filters.relation.needThree")}
          </Text>
        ) : null}
      </Stack>
    </RelationBox>
  );
}
