"use client";

import { ArrowDown, ArrowUp, X } from "lucide-react";
import type { ReactNode } from "react";
import styled, { css } from "styled-components";
import { Button, Stack, Text } from "@/components/ui";
import { useI18n } from "@/i18n";

// Small primitives the export screens need and the shared set does not have yet.

export const ICON_SIZE = 16;
export const Option = styled.option``;

const Group = styled.fieldset`
  ${({ theme: { space } }) => css`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(200px, 100%), 1fr));
    gap: ${space.md};
    min-inline-size: 0;
    margin: 0;
    padding: 0;
    border: 0;
  `}
`;

const GroupLegend = styled.legend`
  ${({ theme: { color, font, space } }) => css`
    padding: 0;
    margin-block-end: ${space.sm};
    color: ${color.textMuted};
    font-size: ${font.size.sm};
    font-weight: ${font.weight.medium};
  `}
`;

const CardLabel = styled.label`
  ${({ theme: { color, radius, size, space } }) => css`
    display: flex;
    align-items: flex-start;
    gap: ${space.sm};
    min-block-size: ${size.touch};
    padding: ${space.md};
    border: 1px solid ${color.border};
    border-radius: ${radius.md};
    background: ${color.surface};
    cursor: pointer;
    &:has(input:checked) {
      border-color: ${color.text};
      background: ${color.surfaceAlt};
    }
    &:has(input:focus-visible) {
      outline: 2px solid ${color.focus};
      outline-offset: 2px;
    }
    &:has(input:disabled) {
      cursor: not-allowed;
      opacity: 0.55;
    }
  `}
`;

const CardRadio = styled.input`
  ${({ theme: { color } }) => css`
    flex: none;
    inline-size: 18px;
    block-size: 18px;
    margin: 2px 0 0;
    accent-color: ${color.primary};
  `}
`;

export interface Choice<T extends string> {
  value: T;
  title: string;
  description?: string;
  disabled?: boolean;
}

interface ChoiceCardsProps<T extends string> {
  legend: string;
  /** Radio group name; unique on the screen. */
  name: string;
  value: T;
  options: readonly Choice<T>[];
  onChange: (value: T) => void;
}

/** Option cards as one native radio group: arrow keys move between cards, Tab leaves the group. */
export function ChoiceCards<T extends string>({ legend, name, value, options, onChange }: ChoiceCardsProps<T>) {
  return (
    <Group>
      <GroupLegend>{legend}</GroupLegend>
      {options.map((option) => (
        <CardLabel key={option.value}>
          <CardRadio
            type="radio"
            name={name}
            checked={option.value === value}
            disabled={option.disabled}
            onChange={() => onChange(option.value)}
          />
          <Stack $gap="xs">
            <Text $medium $size="sm">
              {option.title}
            </Text>
            {option.description ? (
              <Text $muted $size="xs">
                {option.description}
              </Text>
            ) : null}
          </Stack>
        </CardLabel>
      ))}
    </Group>
  );
}

/** A plain labelled group of controls. */
export const Fieldset = styled.fieldset`
  ${({ theme: { space } }) => css`
    display: flex;
    flex-direction: column;
    gap: ${space.sm};
    min-inline-size: 0;
    margin: 0;
    padding: 0;
    border: 0;
  `}
`;
export const Legend = GroupLegend;

const Track = styled.div`
  ${({ theme: { color, radius } }) => css`
    inline-size: 100%;
    block-size: 8px;
    overflow: hidden;
    border-radius: ${radius.sm};
    background: ${color.surfaceAlt};
  `}
`;

const Bar = styled.div<{ $percent: number }>`
  ${({ theme: { color }, $percent }) => css`
    inline-size: ${$percent}%;
    block-size: 100%;
    background: ${color.primary};
    transition: inline-size 0.2s ease;
    @media (prefers-reduced-motion: reduce) {
      transition: none;
    }
  `}
`;

export function ProgressBar({ percent, label }: { percent: number; label: string }) {
  return (
    <Track role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
      <Bar $percent={percent} />
    </Track>
  );
}

/** Collapsible section on the native <details> element: keyboard and screen-reader behavior come from the browser. */
export const Disclosure = styled.details`
  ${({ theme: { color, radius, space } }) => css`
    border: 1px solid ${color.border};
    border-radius: ${radius.md};
    background: ${color.surface};
    & > :not(summary) {
      padding: ${space.md};
    }
  `}
`;

export const DisclosureSummary = styled.summary`
  ${({ theme: { font, size, space, bp } }) => css`
    padding: ${space.sm} ${space.md};
    font-size: ${font.size.sm};
    font-weight: ${font.weight.medium};
    cursor: pointer;
    @media (max-width: ${bp.mobile}) {
      min-block-size: ${size.touch};
      align-content: center;
    }
  `}
`;

/** A row of an ordered list (chosen fields, sorts): the content, then its move and remove buttons. */
export const ListRow = styled.div`
  ${({ theme: { color, radius, space } }) => css`
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: ${space.sm};
    padding: ${space.xs} ${space.sm};
    border: 1px solid ${color.border};
    border-radius: ${radius.sm};
  `}
`;

interface RowActionsProps {
  /** What the row is, for the button names: "Move Country up". */
  name: string;
  onUp?: () => void;
  onDown?: () => void;
  onRemove?: () => void;
  /** False for lists whose order does not matter: only the remove button is shown. */
  movable?: boolean;
}

/** Keyboard-friendly reordering: plain buttons instead of drag and drop. An absent handler disables its button. */
export function RowActions({ name, onUp, onDown, onRemove, movable = true }: RowActionsProps) {
  const { t } = useI18n();
  return (
    <Stack $row $gap="xs">
      {movable ? (
        <>
          <Button $icon $variant="ghost" aria-label={t("export.move.up", { name })} disabled={!onUp} onClick={onUp}>
            <ArrowUp size={ICON_SIZE} aria-hidden />
          </Button>
          <Button $icon $variant="ghost" aria-label={t("export.move.down", { name })} disabled={!onDown} onClick={onDown}>
            <ArrowDown size={ICON_SIZE} aria-hidden />
          </Button>
        </>
      ) : null}
      <Button $icon $variant="ghost" aria-label={t("export.remove", { name })} disabled={!onRemove} onClick={onRemove}>
        <X size={ICON_SIZE} aria-hidden />
      </Button>
    </Stack>
  );
}

/** Label and value on one line of a read-only summary. */
export function SummaryLine({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Stack $row $wrap $gap="sm" $align="baseline">
      <Text $muted $size="sm">
        {label}
      </Text>
      <Text $size="sm">{children}</Text>
    </Stack>
  );
}

/** Moves one item of a list by `delta` places; out-of-range moves return the list unchanged. */
export function moveItem<T>(list: readonly T[], index: number, delta: number): T[] {
  const target = index + delta;
  if (index < 0 || index >= list.length || target < 0 || target >= list.length) return [...list];
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function toggleItem<T>(list: readonly T[], item: T, on: boolean): T[] {
  const without = list.filter((other) => other !== item);
  return on ? [...without, item] : without;
}

/** Reads a <select> value back into its union type; an unknown value keeps the current one. */
export function pickOption<T extends string>(options: readonly T[], value: string, current: T): T {
  return options.find((option) => option === value) ?? current;
}
