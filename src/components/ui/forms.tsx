"use client";

import { X } from "lucide-react";
import { useId, type ReactNode } from "react";
import styled, { css } from "styled-components";
import { Text } from "./index";

const CHIP_ICON = 14;

export const Textarea = styled.textarea`
  ${({ theme: { color, font, radius, space } }) => css`
    inline-size: 100%;
    min-block-size: 96px;
    padding: ${space.sm} ${space.md};
    border: 1px solid ${color.border};
    border-radius: ${radius.sm};
    background: ${color.surface};
    color: ${color.text};
    font: inherit;
    font-size: ${font.size.sm};
    resize: vertical;
  `}
`;

const CheckRow = styled.label`
  ${({ theme: { font, space, size, bp } }) => css`
    display: inline-flex;
    align-items: center;
    gap: ${space.sm};
    font-size: ${font.size.sm};
    cursor: pointer;
    @media (max-width: ${bp.mobile}) {
      min-block-size: ${size.touch};
    }
  `}
`;

const CheckInput = styled.input`
  ${({ theme: { color } }) => css`
    inline-size: 18px;
    block-size: 18px;
    margin: 0;
    accent-color: ${color.primary};
  `}
`;

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
  disabled?: boolean;
}

export function Checkbox({ checked, onChange, children, disabled }: ToggleProps) {
  return (
    <CheckRow>
      <CheckInput type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
      {children}
    </CheckRow>
  );
}

export function Radio({ checked, onChange, children, disabled, name }: ToggleProps & { name: string }) {
  return (
    <CheckRow>
      <CheckInput type="radio" name={name} checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
      {children}
    </CheckRow>
  );
}

const FieldBox = styled.div`
  ${({ theme: { space } }) => css`
    display: flex;
    flex-direction: column;
    gap: ${space.xs};
    min-inline-size: 0;
  `}
`;

const FieldLabel = styled.label`
  ${({ theme: { color, font } }) => css`
    color: ${color.textMuted};
    font-size: ${font.size.xs};
    font-weight: ${font.weight.medium};
  `}
`;

const FieldError = styled.span`
  ${({ theme: { color, font } }) => css`
    color: ${color.danger.fg};
    font-size: ${font.size.xs};
  `}
`;

interface FieldProps {
  label: string;
  /** Render the control with the given id so the label points at it. */
  children: (id: string) => ReactNode;
  error?: string;
  hint?: string;
}

/** Label + control + optional hint and error, wired for screen readers. */
export function Field({ label, children, error, hint }: FieldProps) {
  const id = useId();
  return (
    <FieldBox>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {children(id)}
      {hint ? (
        <Text $muted $size="xs">
          {hint}
        </Text>
      ) : null}
      {error ? <FieldError role="alert">{error}</FieldError> : null}
    </FieldBox>
  );
}

const ChipBox = styled.span`
  ${({ theme: { color, font, radius, space } }) => css`
    display: inline-flex;
    align-items: center;
    gap: ${space.xs};
    padding-block: 2px;
    padding-inline: ${space.sm} ${space.xs};
    border: 1px solid ${color.border};
    border-radius: ${radius.sm};
    background: ${color.surface};
    font-size: ${font.size.xs};
    max-inline-size: 100%;
  `}
`;

const ChipRemove = styled.button`
  ${({ theme: { radius } }) => css`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    inline-size: 24px;
    block-size: 24px;
    padding: 0;
    border: 0;
    border-radius: ${radius.sm};
    background: transparent;
    color: inherit;
    cursor: pointer;
  `}
`;

/** A removable tag, for active filters, selected values and similar. */
export function Chip({ children, onRemove, removeLabel }: { children: ReactNode; onRemove?: () => void; removeLabel?: string }) {
  return (
    <ChipBox>
      {children}
      {onRemove ? (
        <ChipRemove type="button" aria-label={removeLabel} onClick={onRemove}>
          <X size={CHIP_ICON} aria-hidden />
        </ChipRemove>
      ) : null}
    </ChipBox>
  );
}

export const Divider = styled.hr`
  ${({ theme: { color } }) => css`
    inline-size: 100%;
    margin: 0;
    border: 0;
    border-block-start: 1px solid ${color.border};
  `}
`;
