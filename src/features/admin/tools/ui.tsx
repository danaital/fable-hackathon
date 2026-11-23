"use client";

import type { LucideIcon } from "lucide-react";
import { useId, useState, type FormEvent, type ReactNode } from "react";
import styled, { css } from "styled-components";
import { Button, Dialog, Field, Heading, Input, Notice, Paragraph, Select, Stack, VisuallyHidden, useToast } from "@/components/ui";
import { RequireRole, type Role } from "@/features/auth";
import { useI18n, type I18nKey } from "@/i18n";
import type { LocalStore } from "@/lib/store";
import { stableStringify } from "./configImport";

// Small pieces every admin tools screen shares. Tables are in table.tsx.

export const ICON_SIZE = 16;
export const Option = styled.option``;
export const List = styled.ul`
  ${({ theme: { space } }) => css`
    display: flex;
    flex-direction: column;
    gap: ${space.sm};
    margin: 0;
    padding: 0;
    list-style: none;
  `}
`;
export const ListItem = styled.li``;

const Form = styled.form`
  ${({ theme: { space } }) => css`
    display: flex;
    flex-direction: column;
    gap: ${space.lg};
  `}
`;

export const DangerButton = styled(Button)`
  ${({ theme: { color } }) => css`
    background: ${color.danger.fg};
    border-color: ${color.danger.fg};
    color: ${color.danger.bg};
  `}
`;

/** Search takes the whole row on a phone, where the toolbar stacks. */
const SearchSlot = styled.div`
  ${({ theme: { bp } }) => css`
    flex: 1 1 240px;
    max-inline-size: 420px;
    @media (max-width: ${bp.mobile}) {
      flex-basis: 100%;
      max-inline-size: none;
    }
  `}
`;

interface PageProps {
  min: Role;
  /** Also require the one protected top account, like the screen's nav item. */
  rootOnly?: boolean;
  title: string;
  description: string;
  children: ReactNode;
}

/** Role gate, page heading and intro. Every admin tools screen starts with this. */
export function AdminPage({ min, rootOnly, title, description, children }: PageProps) {
  // shortcut: a screen-level gate on the session; the data is in this browser, so there is no server to check yet.
  // Upgrade: every /api/admin route repeats this role check on the server.
  return (
    <RequireRole min={min} rootOnly={rootOnly}>
      <Stack $gap="lg">
        <Stack $gap="xs">
          <Heading>{title}</Heading>
          <Paragraph $muted $size="sm">
            {description}
          </Paragraph>
        </Stack>
        {children}
      </Stack>
    </RequireRole>
  );
}

export function SearchBox({ value, onChange, label }: { value: string; onChange: (value: string) => void; label: string }) {
  const id = useId();
  return (
    <SearchSlot>
      <VisuallyHidden as="label" htmlFor={id}>
        {label}
      </VisuallyHidden>
      <Input id={id} type="search" value={value} placeholder={label} onChange={(event) => onChange(event.target.value)} />
    </SearchSlot>
  );
}

interface IconButtonProps {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  disabled?: boolean;
}

/** Icon-only action with an accessible name and a tooltip. 44px on touch screens (shared Button). */
export function IconButton({ label, icon: Icon, onClick, disabled }: IconButtonProps) {
  return (
    <Button type="button" $variant="ghost" $icon aria-label={label} title={label} disabled={disabled} onClick={onClick}>
      <Icon size={ICON_SIZE} aria-hidden />
    </Button>
  );
}

const FullSelect = styled(Select)`
  inline-size: 100%;
`;

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly SelectOption[];
  /** Text of the empty first choice. Absent: there is no empty choice. */
  placeholder?: string;
  disabled?: boolean;
  hint?: string;
}

/** A labeled list of choices. */
export function SelectField({ label, value, onChange, options, placeholder, disabled, hint }: SelectFieldProps) {
  return (
    <Field label={label} hint={hint}>
      {(id) => (
        <FullSelect id={id} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
          {placeholder === undefined ? null : <Option value="">{placeholder}</Option>}
          {options.map((option) => (
            <Option key={option.value} value={option.value}>
              {option.label}
            </Option>
          ))}
        </FullSelect>
      )}
    </Field>
  );
}

/** Case-insensitive "contains" over everything a row shows, for the search boxes. */
export const matchesQuery = (query: string, values: readonly (string | number | null)[]): boolean => values.join(" ").toLowerCase().includes(query.trim().toLowerCase());

/** Text in one language inside a page of the other: set `dir` and `lang` on it. Also keeps technical values left to right. */
export const LangText = styled.span`
  unicode-bidi: isolate;
  overflow-wrap: anywhere;
`;

interface SaveInput<T> {
  store: Pick<LocalStore<T>, "read" | "write">;
  value: T;
  /** Success toast. */
  title: I18nKey;
  titleVars?: Record<string, string | number>;
}

/** Writes a browser store, reads it back and says how it went. False when the browser refused the write. */
export function useSave() {
  const toast = useToast();
  return <T,>({ store, value, title, titleVars }: SaveInput<T>): boolean => {
    store.write(value);
    const stored = stableStringify(store.read()) === stableStringify(value);
    if (stored) toast.success({ title, titleVars });
    else toast.error({ title: "adminTools.saveFailed" });
    return stored;
  };
}

interface FormDialogProps {
  open: boolean;
  title: string;
  /** A touched form asks before it closes. */
  dirty: boolean;
  onClose: () => void;
  onSubmit: () => void;
  submitLabel: string;
  submitDisabled?: boolean;
  /** Why the last save was refused. Stays next to the form, not only in the status line. */
  error?: string | null;
  children: ReactNode;
  $wide?: boolean;
}

/** Create and edit forms: a dialog with the form inside, Cancel and Save below it. Keep the draft in the caller. */
export function FormDialog({ open, title, dirty, onClose, onSubmit, submitLabel, submitDisabled, error, children, $wide }: FormDialogProps) {
  const { t } = useI18n();
  const formId = useId();
  // The native dialog has already closed when it reports Escape; a new key opens it again if the user keeps editing.
  const [reopened, setReopened] = useState(0);
  const close = () => {
    if (dirty && !window.confirm(t("adminTools.discard"))) setReopened((count) => count + 1);
    else onClose();
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit();
  };
  return (
    <Dialog
      key={reopened}
      open={open}
      onClose={close}
      title={title}
      $wide={$wide}
      footer={
        <>
          <Button type="button" onClick={close}>
            {t("action.cancel")}
          </Button>
          <Button type="submit" form={formId} $variant="primary" disabled={submitDisabled}>
            {submitLabel}
          </Button>
        </>
      }
    >
      <Form id={formId} onSubmit={submit} noValidate>
        {children}
        {error ? (
          <Notice $tone="danger" role="alert">
            {error}
          </Notice>
        ) : null}
      </Form>
    </Dialog>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
  children: ReactNode;
  /** Destructive actions use the danger button. */
  danger?: boolean;
}

export function ConfirmDialog({ open, title, confirmLabel, onConfirm, onClose, children, danger }: ConfirmDialogProps) {
  const { t } = useI18n();
  const Confirm = danger ? DangerButton : Button;
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button type="button" onClick={onClose}>
            {t("action.cancel")}
          </Button>
          <Confirm type="button" $variant="primary" onClick={onConfirm}>
            {confirmLabel}
          </Confirm>
        </>
      }
    >
      {children}
    </Dialog>
  );
}
