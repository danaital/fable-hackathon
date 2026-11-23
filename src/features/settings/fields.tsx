"use client";

import { useState } from "react";
import styled from "styled-components";
import { Field, Input, Select } from "@/components/ui";
import { useI18n } from "@/i18n";

/** Native option element for the shared Select. */
export const Option = styled.option``;

const INHERIT = "";

export interface ChoiceFieldProps<T extends string> {
  label: string;
  value: T | undefined;
  options: readonly T[];
  optionLabel: (option: T) => string;
  onChange: (value: T | undefined) => void;
  /** Report level: adds a "use my settings" option naming the value it would inherit. */
  inherited?: T;
  /** Text for the inherit option when the inherited value is not one of `options`; also enables that option. */
  inheritLabel?: string;
  hint?: string;
  error?: string;
}

/** A labelled select. With `inherited`, an empty choice means "inherit". */
export function ChoiceField<T extends string>({ label, value, options, optionLabel, onChange, inherited, inheritLabel, hint, error }: ChoiceFieldProps<T>) {
  const { t } = useI18n();
  const inheritText = inheritLabel ?? (inherited === undefined ? undefined : t("settings.inherit", { value: optionLabel(inherited) }));
  return (
    <Field label={label} hint={hint} error={error}>
      {(id) => (
        <Select
          id={id}
          value={value ?? INHERIT}
          aria-invalid={error ? true : undefined}
          onChange={(event) => onChange(options.find((option) => option === event.target.value))}
        >
          {inheritText === undefined ? null : <Option value={INHERIT}>{inheritText}</Option>}
          {options.map((option) => (
            <Option key={option} value={option}>
              {optionLabel(option)}
            </Option>
          ))}
        </Select>
      )}
    </Field>
  );
}

interface NumberFieldProps {
  label: string;
  value: number | undefined;
  min: number;
  max: number;
  onChange: (value: number | undefined) => void;
  /** Report level: empty means "inherit" and the inherited value is shown as the placeholder. */
  inherited?: number;
}

const parse = (text: string) => (text.trim() === "" ? undefined : Number(text));

/** Whole-number input with its range check shown as text, not colour alone. */
export function NumberField({ label, value, min, max, onChange, inherited }: NumberFieldProps) {
  const { t } = useI18n();
  const [text, setText] = useState(value === undefined ? "" : String(value));
  // Follow outside changes (reset) unless the typed text already means the same value.
  const blank = value === undefined || Number.isNaN(value);
  const shown = Object.is(parse(text), value) || (blank && text.trim() === "") ? text : String(blank ? "" : value);
  const valid = value === undefined ? inherited !== undefined : Number.isInteger(value) && value >= min && value <= max;
  return (
    <Field
      label={label}
      hint={inherited === undefined ? undefined : t("settings.inherit", { value: inherited })}
      error={valid ? undefined : t("settings.digits.error", { min, max })}
    >
      {(id) => (
        <Input
          id={id}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          step={1}
          value={shown}
          placeholder={inherited === undefined ? undefined : String(inherited)}
          aria-invalid={valid ? undefined : true}
          onChange={(event) => {
            setText(event.target.value);
            onChange(parse(event.target.value));
          }}
        />
      )}
    </Field>
  );
}
