"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useId, useState, type KeyboardEvent } from "react";
import { Checkbox, Input, Stack, Text } from "@/components/ui";
import { useI18n } from "@/i18n";
import { GroupLabel, ScrollList, WideButton } from "./parts";

const ICON_SIZE = 14;
/** The one limit on how many options a list shows at once; the user is told when it cuts the list. */
export const VISIBLE_OPTION_LIMIT = 200;
const STEP: Partial<Record<string, number>> = { ArrowDown: 1, ArrowUp: -1 };

export interface SelectOption {
  value: string;
  label: string;
}

interface MultiSelectProps {
  label: string;
  options: readonly SelectOption[];
  selected: readonly string[];
  onChange: (selected: string[]) => void;
}

// Up and Down move between the checkboxes; Space ticks one, as checkboxes do on their own.
function moveFocus(event: KeyboardEvent<HTMLDivElement>) {
  const step = STEP[event.key];
  if (!step) return;
  const boxes = [...event.currentTarget.querySelectorAll<HTMLInputElement>("input")];
  const next = boxes[boxes.findIndex((box) => box === document.activeElement) + step];
  if (!next) return;
  event.preventDefault();
  next.focus();
}

/** Searchable list of checkboxes that opens in place, so it also works inside a full-screen dialog on a phone. */
export function MultiSelect({ label, options, selected, onChange }: MultiSelectProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const labelId = useId();
  const buttonId = useId();
  const panelId = useId();

  const chosen = new Set(selected);
  const needle = term.trim().toLowerCase();
  const matches = needle ? options.filter((option) => option.label.toLowerCase().includes(needle)) : options;
  const visible = matches.slice(0, VISIBLE_OPTION_LIMIT);
  const Icon = open ? ChevronUp : ChevronDown;

  const toggle = (value: string, checked: boolean) => {
    onChange(checked ? [...selected, value] : selected.filter((item) => item !== value));
  };

  return (
    <Stack $gap="xs">
      <GroupLabel id={labelId}>{label}</GroupLabel>
      <WideButton
        id={buttonId}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-labelledby={`${labelId} ${buttonId}`}
        onClick={() => setOpen(!open)}
      >
        {selected.length > 0 ? t("filters.multi.selected", { count: selected.length }) : t("filters.multi.choose")}
        <Icon size={ICON_SIZE} aria-hidden />
      </WideButton>
      {open ? (
        <Stack id={panelId} $gap="xs" role="group" aria-labelledby={labelId}>
          <Input type="search" value={term} aria-label={t("filters.multi.search")} placeholder={t("filters.multi.search")} onChange={(event) => setTerm(event.target.value)} />
          <ScrollList onKeyDown={moveFocus}>
            {visible.map((option) => (
              <Checkbox key={option.value} checked={chosen.has(option.value)} onChange={(checked) => toggle(option.value, checked)}>
                {option.label}
              </Checkbox>
            ))}
            {visible.length === 0 ? (
              <Text $muted $size="sm">
                {t("filters.multi.none")}
              </Text>
            ) : null}
          </ScrollList>
          {matches.length > visible.length ? (
            <Text $muted $size="xs" role="status">
              {t("filters.multi.truncated", { count: VISIBLE_OPTION_LIMIT })}
            </Text>
          ) : null}
        </Stack>
      ) : null}
    </Stack>
  );
}
