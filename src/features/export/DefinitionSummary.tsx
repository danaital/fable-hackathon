"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { Chip, Stack, Text, VisuallyHidden } from "@/components/ui";
import type { FieldDef } from "@/data/types";
import type { SortRule } from "@/features/grid/sort";
import type { FilterRule } from "@/features/report/viewState";
import { useI18n } from "@/i18n";
import { describeFilter, fieldLabel } from "./describe";
import { ICON_SIZE } from "./ui";

/** Sorts as chips with a direction arrow that also has a text alternative. Sorts on fields the report lost are hidden. */
export function SortChips({ sorts, fields }: { sorts: readonly SortRule[]; fields: readonly FieldDef[] }) {
  const { t, tData } = useI18n();
  const known = sorts.filter((rule) => fields.some((field) => field.key === rule.key));
  if (known.length === 0) return <Text $muted $size="sm">{t("export.none.sorts")}</Text>;
  return (
    <Stack $row $wrap $gap="xs">
      {known.map((rule) => {
        const Arrow = rule.direction === "asc" ? ArrowUp : ArrowDown;
        return (
          <Chip key={rule.key}>
            {fieldLabel(rule.key, { fields, t, tData })}
            <Arrow size={ICON_SIZE} aria-hidden />
            <VisuallyHidden>{t(rule.direction === "asc" ? "export.sort.asc" : "export.sort.desc")}</VisuallyHidden>
          </Chip>
        );
      })}
    </Stack>
  );
}

/** Filters as read-only chips: "Status is Late". Switched-off filters are left out, as they are in the file. */
export function FilterChips({ filters, fields }: { filters: readonly FilterRule[]; fields: readonly FieldDef[] }) {
  const { t, tData } = useI18n();
  const active = filters.filter((rule) => rule.enabled !== false);
  if (active.length === 0) return <Text $muted $size="sm">{t("export.none.filters")}</Text>;
  return (
    <Stack $row $wrap $gap="xs">
      {active.map((rule) => (
        <Chip key={rule.id}>{describeFilter(rule, { fields, t, tData })}</Chip>
      ))}
    </Stack>
  );
}

interface Props {
  fields: readonly FieldDef[];
  /** Column keys; keys the report no longer has are not counted. */
  columns: readonly string[];
  sorts: readonly SortRule[];
  filters: readonly FilterRule[];
}

/** What a view, a template or the live page brings to an export: its columns, sorts and filters. */
export function DefinitionSummary({ fields, columns, sorts, filters }: Props) {
  const { t } = useI18n();
  const shown = columns.flatMap((key) => fields.find((field) => field.key === key) ?? []);
  return (
    <Stack $gap="sm">
      <Text $muted $size="sm">
        {t("export.summary.fields", { count: shown.length })}
      </Text>
      <Stack $row $wrap $gap="xs">
        {shown.map((field) => (
          <Chip key={field.key}>{t(field.labelKey)}</Chip>
        ))}
      </Stack>
      <Text $muted $size="sm">
        {t("export.summary.sorts")}
      </Text>
      <SortChips sorts={sorts} fields={fields} />
      <Text $muted $size="sm">
        {t("export.summary.filters")}
      </Text>
      <FilterChips filters={filters} fields={fields} />
    </Stack>
  );
}
