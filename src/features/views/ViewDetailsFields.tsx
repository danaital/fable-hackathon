"use client";

import { useState, type KeyboardEvent, type Ref } from "react";
import { Checkbox, Field, Input, Textarea } from "@/components/ui";
import { useI18n, type I18nKey } from "@/i18n";
import type { NameError } from "./logic";
import { NAME_MAX_LENGTH, NAME_MIN_LENGTH } from "./model";
import { ErrorText } from "./parts";

export interface ViewDetails {
  name: string;
  description: string;
  makeDefault: boolean;
}

const ERROR_KEYS: Record<NameError, I18nKey> = {
  required: "views.name.required",
  tooShort: "views.name.tooShort",
  tooLong: "views.name.tooLong",
  duplicate: "views.name.duplicate",
};
const ENTER_KEY = "Enter";

interface Props {
  value: ViewDetails;
  onChange: (value: ViewDetails) => void;
  /** Result of validating the name on every keystroke. */
  error: NameError | null;
  /** Enter in the description submits; Shift+Enter adds a line. */
  onEnter?: () => void;
  nameRef?: Ref<HTMLInputElement>;
}

/** Name, description and "set as my default": the same three fields in the save dialog and the wizard. */
export function ViewDetailsFields({ value, onChange, error, onEnter, nameRef }: Props) {
  const { t } = useI18n();
  const [touched, setTouched] = useState(false);
  // An empty name on a form nobody has typed in yet is not worth an error; the save button is disabled anyway.
  const shownError = error && (error !== "required" || touched) ? error : null;

  const onDescriptionKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!onEnter || event.key !== ENTER_KEY || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    onEnter();
  };

  return (
    <>
      <Field label={t("views.form.name")} hint={t("views.form.nameHint", { min: NAME_MIN_LENGTH, max: NAME_MAX_LENGTH })}>
        {(id) => (
          <>
            <Input
              id={id}
              ref={nameRef}
              value={value.name}
              required
              aria-invalid={shownError !== null}
              aria-describedby={shownError ? `${id}-error` : undefined}
              onChange={(event) => onChange({ ...value, name: event.target.value })}
              onBlur={() => setTouched(true)}
            />
            {shownError ? (
              <ErrorText id={`${id}-error`} role="alert">
                {t(ERROR_KEYS[shownError], { min: NAME_MIN_LENGTH, max: NAME_MAX_LENGTH })}
              </ErrorText>
            ) : null}
          </>
        )}
      </Field>
      <Field label={t("views.form.description")}>
        {(id) => (
          <Textarea
            id={id}
            value={value.description}
            onChange={(event) => onChange({ ...value, description: event.target.value })}
            onKeyDown={onDescriptionKey}
          />
        )}
      </Field>
      <Checkbox checked={value.makeDefault} onChange={(makeDefault) => onChange({ ...value, makeDefault })}>
        {t("views.form.makeDefault")}
      </Checkbox>
    </>
  );
}
