"use client";

import { SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { Button, Checkbox, Dialog, Field, Input, Stack, Text } from "@/components/ui";
import { useI18n } from "@/i18n";

const ICON_SIZE = 16;

interface VisibilityDialogProps {
  /** Button text and dialog title, for example "Choose key figures". */
  label: string;
  items: readonly { id: string; title: string }[];
  /** The view's list: `null` shows all, an empty list shows none. */
  shown: readonly string[] | null;
  onChange: (shown: string[] | null) => void;
}

/** Button plus dialog to show or hide the items of one kind. Changes apply at once and are part of the view. */
export function VisibilityDialog({ label, items, shown, onChange }: VisibilityDialogProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const isShown = (id: string) => shown === null || shown.includes(id);
  const shownCount = items.filter((item) => isShown(item.id)).length;
  const term = search.trim().toLowerCase();
  const matches = items.filter((item) => item.title.toLowerCase().includes(term));

  const toggle = (id: string, checked: boolean) => {
    const next = items.filter((item) => (item.id === id ? checked : isShown(item.id))).map((item) => item.id);
    // Every item checked is stored as "show all", so items added to the report later appear too.
    onChange(next.length === items.length ? null : next);
  };

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <SlidersHorizontal size={ICON_SIZE} aria-hidden />
        {label}
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={label}
        footer={
          <Button $variant="primary" onClick={() => setOpen(false)}>
            {t("action.done")}
          </Button>
        }
      >
        <Field label={t("summary.visibility.search")}>
          {(id) => <Input id={id} type="search" value={search} onChange={(event) => setSearch(event.target.value)} />}
        </Field>
        <Stack $row $wrap $justify="space-between" $gap="sm">
          <Text $muted $size="sm" role="status">
            {t("summary.visibility.count", { shown: shownCount, total: items.length })}
          </Text>
          <Stack $row $gap="sm">
            <Button onClick={() => onChange(null)}>{t("summary.visibility.showAll")}</Button>
            <Button onClick={() => onChange([])}>{t("summary.visibility.hideAll")}</Button>
          </Stack>
        </Stack>
        <Stack $gap="xs">
          {matches.length === 0 ? <Text $muted>{t("summary.visibility.noMatch")}</Text> : null}
          {matches.map((item) => (
            <Checkbox key={item.id} checked={isShown(item.id)} onChange={(checked) => toggle(item.id, checked)}>
              {item.title}
            </Checkbox>
          ))}
        </Stack>
      </Dialog>
    </>
  );
}
