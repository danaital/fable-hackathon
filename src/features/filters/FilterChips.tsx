"use client";

import { Loader } from "lucide-react";
import { Badge, Chip, Ltr, Stack, Text } from "@/components/ui";
import type { FieldDef, FieldType } from "@/data/types";
import { useI18n } from "@/i18n";
import { usesRates } from "./engine";
import { isCompareRule, type FilterSpec } from "./operators";
import { useFilterText } from "./useFilterText";

const ICON_SIZE = 12;
// Numbers and addresses keep left-to-right order inside Hebrew text.
const LTR_TYPES: ReadonlySet<FieldType> = new Set<FieldType>(["number", "currency", "percent", "email"]);

interface FilterChipsProps {
  rules: readonly FilterSpec[];
  fields: ReadonlyMap<string, FieldDef>;
  /** `false` while exchange rates are loading. */
  ratesReady: boolean;
  onRemove: (rule: FilterSpec) => void;
}

/** One-line summary of the filters, shown while the toolbar is collapsed. */
export function FilterChips({ rules, fields, ratesReady, onRemove }: FilterChipsProps) {
  const { t } = useI18n();
  const text = useFilterText();

  return (
    <Stack $row $wrap $gap="sm" role="list">
      {rules.map((rule) => {
        const field = fields.get(rule.field);
        if (!field) return null;
        const title = text.title(rule);
        const { operator, value } = text.describe(rule, field);
        const Value = LTR_TYPES.has(field.type) && !isCompareRule(rule) ? Ltr : Text;
        return (
          <Stack key={rule.id} $row $gap="xs" role="listitem">
            <Chip onRemove={() => onRemove(rule)} removeLabel={t("filters.card.remove", { field: title })}>
              <Text $medium $size="xs">
                {title}
              </Text>
              {operator ? (
                <Text $muted $size="xs">
                  {operator}
                </Text>
              ) : null}
              {value ? <Value>{value}</Value> : null}
              {rule.enabled === false ? <Badge>{t("filters.card.off")}</Badge> : null}
              {rule.mandatory ? <Badge $tone="info">{t("filters.card.required")}</Badge> : null}
              {usesRates(rule, field) && !ratesReady ? (
                <Badge $tone="warning" role="status">
                  <Loader size={ICON_SIZE} aria-hidden />
                  {t("filters.chip.ratesLoading")}
                </Badge>
              ) : null}
            </Chip>
          </Stack>
        );
      })}
    </Stack>
  );
}
