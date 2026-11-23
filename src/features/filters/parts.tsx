"use client";

import { useEffect, useState, type ComponentProps } from "react";
import styled, { css } from "styled-components";
import { Button, Card, Input } from "@/components/ui";

/** Small styled pieces used only by the filter toolbar. */

export const Option = styled.option``;
export const OptGroup = styled.optgroup``;

export const ToolbarBox = styled(Card).attrs({ as: "section" })`
  ${({ theme: { space } }) => css`
    display: flex;
    flex-direction: column;
    gap: ${space.md};
  `}
`;

export const SearchSlot = styled.div`
  ${({ theme: { bp } }) => css`
    flex: 1 1 240px;
    min-inline-size: 0;
    @media (max-width: ${bp.mobile}) {
      flex-basis: 100%;
    }
  `}
`;

/** The relation choice gets its own tinted box so it is easy to find. */
export const RelationBox = styled.div`
  ${({ theme: { color, radius, space } }) => css`
    display: flex;
    flex-direction: column;
    gap: ${space.sm};
    padding: ${space.md};
    border: 1px solid ${color.border};
    border-radius: ${radius.md};
    background: ${color.surfaceAlt};
  `}
`;

export const CardList = styled.div`
  ${({ theme: { space } }) => css`
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(300px, 100%), 1fr));
    gap: ${space.md};
    align-items: start;
  `}
`;

export const RuleCard = styled.div<{ $off: boolean }>`
  ${({ theme: { color, radius, space }, $off }) => css`
    display: flex;
    flex-direction: column;
    gap: ${space.md};
    min-inline-size: 0;
    padding: ${space.md};
    border: 1px ${$off ? "dashed" : "solid"} ${color.border};
    border-radius: ${radius.md};
    background: ${$off ? color.surfaceAlt : color.surface};
  `}
`;

export const EmptyBox = styled.div`
  ${({ theme: { color, font, radius, space } }) => css`
    padding: ${space.lg};
    border: 1px dashed ${color.border};
    border-radius: ${radius.md};
    color: ${color.textMuted};
    font-size: ${font.size.sm};
    text-align: center;
  `}
`;

/** Two inputs side by side that stack when the card is narrow. */
export const Pair = styled.div`
  ${({ theme: { space } }) => css`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(140px, 100%), 1fr));
    gap: ${space.sm};
  `}
`;

export const ScrollList = styled.div`
  ${({ theme: { color, radius, space } }) => css`
    display: flex;
    flex-direction: column;
    gap: ${space.xs};
    max-block-size: 220px;
    overflow-y: auto;
    padding: ${space.sm};
    border: 1px solid ${color.border};
    border-radius: ${radius.sm};
  `}
`;

export const WideButton = styled(Button)`
  inline-size: 100%;
  justify-content: space-between;
`;

export const GroupLabel = styled.span`
  ${({ theme: { color, font } }) => css`
    color: ${color.textMuted};
    font-size: ${font.size.xs};
    font-weight: ${font.weight.medium};
  `}
`;

const DEBOUNCE_MS = 200;

type DebouncedInputProps = Omit<ComponentProps<typeof Input>, "value" | "onChange"> & {
  value: string;
  onCommit: (value: string) => void;
  /** True when the typed text and the stored value mean the same, so typing "1." is not overwritten by a stored 1. */
  isSame?: (draft: string, value: string) => boolean;
};

const sameText = (draft: string, value: string) => draft === value;

/** Text input that reports what was typed after a short pause, so rows are not re-filtered on every key. */
export function DebouncedInput({ value, onCommit, isSame = sameText, ...rest }: DebouncedInputProps) {
  const [draft, setDraft] = useState(value);
  const [seen, setSeen] = useState(value);
  // The stored value changed from outside (clear, reset): show it, unless it is what was just typed.
  if (value !== seen) {
    setSeen(value);
    if (!isSame(draft, value)) setDraft(value);
  }

  useEffect(() => {
    if (isSame(draft, value)) return;
    const timer = setTimeout(() => onCommit(draft), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [draft, value, onCommit, isSame]);

  return <Input {...rest} value={draft} onChange={(event) => setDraft(event.target.value)} />;
}
