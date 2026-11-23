"use client";

import { Lock, Plus } from "lucide-react";
import { Button, Card, Grid, Notice, Stack, Text } from "@/components/ui";
import { anchorKeys } from "@/features/grid/columns";
import { useI18n } from "@/i18n";
import { resolveColumns } from "../plan";
import { ICON_SIZE, ListRow, RowActions, moveItem } from "../ui";
import type { StepProps } from "./types";

const LIST_MIN_WIDTH = "280px";

/** "Template": the template's columns, read-only. "Custom": pick the columns and put them in file order. */
export function FieldsStep({ state, dispatch, page }: StepProps) {
  const { t } = useI18n();
  const { fields } = page.report;

  if (state.source !== "custom") {
    return <Notice $tone="info">{t("export.fields.fromTemplate", { count: resolveColumns(state, page).length })}</Notice>;
  }

  const anchors = anchorKeys(fields);
  const selected = state.selectedFields.flatMap((key) => fields.find((field) => field.key === key) ?? []);
  const available = fields.filter((field) => !state.selectedFields.includes(field.key));
  const setSelected = (keys: string[]) => dispatch({ type: "patch", patch: { selectedFields: keys } });
  const keys = selected.map((field) => field.key);

  return (
    <>
      <Text $muted $size="sm">
        {t("export.fields.hint")}
      </Text>
      {selected.length === 0 ? (
        <Notice $tone="warning" role="alert">
          {t("export.invalid.fields")}
        </Notice>
      ) : null}
      <Grid $min={LIST_MIN_WIDTH}>
        <Card>
          <Stack $gap="sm" role="group" aria-label={t("export.fields.available", { count: available.length })}>
            <Stack $row $wrap $justify="space-between" $gap="sm">
              <Text $medium $size="sm">
                {t("export.fields.available", { count: available.length })}
              </Text>
              <Button disabled={available.length === 0} onClick={() => setSelected([...keys, ...available.map((field) => field.key)])}>
                {t("export.fields.addAll")}
              </Button>
            </Stack>
            {available.map((field) => (
              <ListRow key={field.key}>
                <Text $size="sm">{t(field.labelKey)}</Text>
                <Button
                  $icon
                  $variant="ghost"
                  aria-label={t("export.fields.add", { name: t(field.labelKey) })}
                  onClick={() => setSelected([...keys, field.key])}
                >
                  <Plus size={ICON_SIZE} aria-hidden />
                </Button>
              </ListRow>
            ))}
            {available.length === 0 ? (
              <Text $muted $size="sm">
                {t("export.fields.noneLeft")}
              </Text>
            ) : null}
          </Stack>
        </Card>
        <Card>
          <Stack $gap="sm" role="group" aria-label={t("export.fields.selected", { count: selected.length })}>
            <Stack $row $wrap $justify="space-between" $gap="sm">
              <Text $medium $size="sm">
                {t("export.fields.selected", { count: selected.length })}
              </Text>
              <Button disabled={selected.length <= anchors.length} onClick={() => setSelected(keys.filter((key) => anchors.includes(key)))}>
                {t("export.fields.removeAll")}
              </Button>
            </Stack>
            {selected.map((field, index) => {
              const locked = anchors.includes(field.key);
              const name = t(field.labelKey);
              return (
                <ListRow key={field.key}>
                  <Stack $row $gap="xs">
                    {locked ? <Lock size={ICON_SIZE} aria-label={t("export.fields.locked")} /> : null}
                    <Text $size="sm">{name}</Text>
                  </Stack>
                  <RowActions
                    name={name}
                    onUp={index > 0 ? () => setSelected(moveItem(keys, index, -1)) : undefined}
                    onDown={index < keys.length - 1 ? () => setSelected(moveItem(keys, index, 1)) : undefined}
                    onRemove={locked ? undefined : () => setSelected(keys.filter((key) => key !== field.key))}
                  />
                </ListRow>
              );
            })}
          </Stack>
        </Card>
      </Grid>
    </>
  );
}
