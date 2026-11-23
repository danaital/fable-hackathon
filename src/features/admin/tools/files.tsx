"use client";

import type { ChangeEvent } from "react";
import styled, { css } from "styled-components";
import { Field, Input } from "@/components/ui";
import { MAX_IMPORT_BYTES } from "./configImport";

const REVOKE_DELAY_MS = 1000;
const JSON_TYPE = "application/json";
const JSON_INDENT = 2;

const FileInput = styled(Input)`
  ${({ theme: { space } }) => css`
    padding-block: ${space.sm};
  `}
`;

export type FileReadError = "tooLarge" | "unreadable";

interface FilePickerProps {
  label: string;
  onText: (text: string) => void;
  onError: (error: FileReadError) => void;
}

/** A labeled `.json` file input. The file is read as text and handed over; nothing is parsed or run here. */
export function FilePicker({ label, onText, onError }: FilePickerProps) {
  const read = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ""; // so picking the same file again fires a change
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) return onError("tooLarge");
    const reader = new FileReader();
    reader.onload = () => (typeof reader.result === "string" ? onText(reader.result) : onError("unreadable"));
    reader.onerror = () => onError("unreadable");
    reader.readAsText(file);
  };
  return <Field label={label}>{(id) => <FileInput id={id} type="file" accept={`.json,${JSON_TYPE}`} onChange={read} />}</Field>;
}

/** Downloads a value as a JSON file through a temporary object URL, which is released afterwards. */
export function downloadJson(fileName: string, value: unknown): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, JSON_INDENT)], { type: JSON_TYPE }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
}
