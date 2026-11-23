"use client";

import styled, { css } from "styled-components";

const HAIRLINE = "1px";
const DROP_LINE = "2px";
const SWITCH_WIDTH = "36px";
const SWITCH_HEIGHT = "20px";
const SWITCH_THUMB = "14px";
const SWITCH_GAP = "2px";
const SWITCH_ON_OFFSET = "18px";
const CHECK_SIZE = "18px";
const MOTION = "120ms";

/** On/off switch. The thumb's position shows the state, so it does not rely on color. */
export const Switch = styled.input.attrs({ type: "checkbox", role: "switch" })`
  ${({ theme: { color } }) => css`
    appearance: none;
    flex: none;
    position: relative;
    inline-size: ${SWITCH_WIDTH};
    block-size: ${SWITCH_HEIGHT};
    margin: 0;
    border: ${HAIRLINE} solid ${color.textMuted};
    border-radius: ${SWITCH_HEIGHT};
    background: ${color.surface};
    cursor: pointer;
    &::after {
      content: "";
      position: absolute;
      inset-block-start: ${SWITCH_GAP};
      inset-inline-start: ${SWITCH_GAP};
      inline-size: ${SWITCH_THUMB};
      block-size: ${SWITCH_THUMB};
      border-radius: 50%;
      background: ${color.textMuted};
      transition: inset-inline-start ${MOTION};
    }
    &:checked {
      background: ${color.primary};
      border-color: ${color.primary};
    }
    &:checked::after {
      inset-inline-start: ${SWITCH_ON_OFFSET};
      background: ${color.onPrimary};
    }
    &:disabled {
      cursor: not-allowed;
      opacity: 0.55;
    }
  `}
`;

/** Gives a small control (checkbox, switch) a touch-sized hit area on phones. */
export const HitArea = styled.label`
  ${({ theme: { size, bp } }) => css`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: none;
    cursor: pointer;
    @media (max-width: ${bp.mobile}) {
      min-inline-size: ${size.touch};
      min-block-size: ${size.touch};
    }
  `}
`;

const CheckInput = styled.input`
  ${({ theme: { color } }) => css`
    inline-size: ${CHECK_SIZE};
    block-size: ${CHECK_SIZE};
    margin: 0;
    accent-color: ${color.primary};
  `}
`;

interface TriCheckProps {
  label: string;
  checked: boolean;
  /** Some, but not all, of the items it stands for are selected. */
  indeterminate?: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}

/** A checkbox with only an accessible name, and the "some selected" state the shared Checkbox lacks. */
export function TriCheck({ label, checked, indeterminate = false, disabled, onChange }: TriCheckProps) {
  return (
    <HitArea>
      <CheckInput
        type="checkbox"
        aria-label={label}
        checked={checked}
        disabled={disabled}
        ref={(element) => {
          if (element) element.indeterminate = indeterminate;
        }}
        onChange={(event) => onChange(event.target.checked)}
      />
    </HitArea>
  );
}

export const SectionBox = styled.section<{ $dropEnd?: boolean }>`
  ${({ theme: { color, radius }, $dropEnd }) => css`
    border: ${HAIRLINE} solid ${color.border};
    border-radius: ${radius.md};
    ${$dropEnd ? `border-block-end: ${DROP_LINE} solid ${color.accent};` : ""}
  `}
`;

export const SectionHead = styled.div`
  ${({ theme: { color, space } }) => css`
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: ${space.sm};
    padding: ${space.xs} ${space.sm};
    background: ${color.surfaceAlt};
    & > h3 {
      flex: 1 1 auto;
      margin: 0;
      font: inherit;
    }
    & > h3 > button {
      inline-size: 100%;
      justify-content: flex-start;
    }
  `}
`;

export const ColumnList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
`;

export const ColumnItem = styled.li<{ $dropBefore?: boolean; $dragging?: boolean }>`
  ${({ theme: { color, space, font }, $dropBefore, $dragging }) => css`
    display: flex;
    align-items: center;
    gap: ${space.xs};
    padding: ${space.xs} ${space.sm};
    border-block-start: ${DROP_LINE} solid ${$dropBefore ? color.accent : "transparent"};
    font-size: ${font.size.sm};
    opacity: ${$dragging ? "0.5" : "1"};
    &[draggable="true"] {
      cursor: grab;
    }
  `}
`;

export const ColumnName = styled.span`
  flex: 1 1 auto;
  min-inline-size: 0;
  overflow-wrap: anywhere;
`;

export const IconSlot = styled.span`
  ${({ theme: { color, size, bp } }) => css`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: none;
    inline-size: ${size.control};
    color: ${color.textMuted};
    @media (max-width: ${bp.mobile}) {
      inline-size: ${size.touch};
    }
  `}
`;

export const DropZone = styled.p`
  ${({ theme: { color, font, radius, space } }) => css`
    margin: ${space.sm};
    padding: ${space.md};
    border: ${HAIRLINE} dashed ${color.textMuted};
    border-radius: ${radius.sm};
    color: ${color.textMuted};
    font-size: ${font.size.sm};
    text-align: center;
  `}
`;

export const ChipList = styled.ul`
  ${({ theme: { space } }) => css`
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: ${space.xs};
    list-style: none;
    margin: 0;
    padding: 0;
  `}
`;

export const ChipItem = styled.li`
  display: inline-flex;
`;
