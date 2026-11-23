"use client";

import { RefreshCw, X } from "lucide-react";
import { useCallback, useEffect, useId, useState, type ReactNode } from "react";
import styled, { css } from "styled-components";
import { Button, ErrorFallback, Heading, Input, LoadingRegion, Paragraph, Skeleton, Stack, VisuallyHidden, useToast } from "@/components/ui";
import { toAuthError } from "@/features/auth/model";
import { useI18n, type I18nKey } from "@/i18n";
import { ICON_SIZE } from "./tools/ui";

// Pieces the users-and-access screens share: header, toolbar, loading, feedback. Tables and dialogs come from ./tools.

/** DataTable page size for the lists that do not paginate. */
export const ALL_ROWS = Number.MAX_SAFE_INTEGER;
const SKELETON_ROWS = [0, 1, 2, 3];

/** Case-insensitive "contains" over the loaded rows. An empty query matches everything. */
export function contains(query: string, texts: readonly string[]): boolean {
  const needle = query.trim().toLowerCase();
  return needle === "" || texts.some((text) => text.toLowerCase().includes(needle));
}

export function ScreenHeader({ titleKey, descKey }: { titleKey: I18nKey; descKey: I18nKey }) {
  const { t } = useI18n();
  return (
    <Stack $gap="xs">
      <Heading as="h2" $size="lg">
        {t(titleKey)}
      </Heading>
      <Paragraph $muted $size="sm">
        {t(descKey)}
      </Paragraph>
    </Stack>
  );
}

/** Search takes the whole row on a phone, where the toolbar stacks. */
const SearchSlot = styled.div`
  ${({ theme: { bp, space } }) => css`
    display: flex;
    gap: ${space.xs};
    flex: 1 1 240px;
    max-inline-size: 420px;
    @media (max-width: ${bp.mobile}) {
      flex-basis: 100%;
      max-inline-size: none;
    }
  `}
`;

interface SearchProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
}

interface ToolbarProps {
  search?: SearchProps;
  /** Absent for lists that follow browser storage live and have nothing to reload. */
  onRefresh?: () => void;
  /** The primary action, between the search and Refresh. */
  children?: ReactNode;
}

export function Toolbar({ search, onRefresh, children }: ToolbarProps) {
  const { t } = useI18n();
  const id = useId();
  return (
    <Stack $row $wrap $gap="sm">
      {search ? (
        <SearchSlot>
          <VisuallyHidden as="label" htmlFor={id}>
            {search.label}
          </VisuallyHidden>
          <Input id={id} value={search.value} placeholder={search.label} onChange={(event) => search.onChange(event.target.value)} />
          {search.value ? (
            <Button type="button" $variant="ghost" $icon aria-label={t("action.clear")} title={t("action.clear")} onClick={() => search.onChange("")}>
              <X size={ICON_SIZE} aria-hidden />
            </Button>
          ) : null}
        </SearchSlot>
      ) : null}
      {children}
      {onRefresh ? (
        <Button type="button" onClick={onRefresh}>
          <RefreshCw size={ICON_SIZE} aria-hidden />
          {t("admin.refresh")}
        </Button>
      ) : null}
    </Stack>
  );
}

type LoadState<T> = { status: "loading" } | { status: "error"; error: unknown } | { status: "ready"; data: T };

export interface Load<T> {
  state: LoadState<T>;
  reload: () => void;
}

/** Loads once and on every reload. Only the newest request may update the screen. `load` must be stable (useCallback). */
export function useLoad<T>(load: () => Promise<T>): Load<T> {
  const [state, setState] = useState<LoadState<T>>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let newest = true;
    load().then(
      (data) => newest && setState({ status: "ready", data }),
      (error: unknown) => newest && setState({ status: "error", error }),
    );
    return () => {
      newest = false;
    };
  }, [load, attempt]);

  // A refresh keeps the rows on screen until the new ones arrive.
  const reload = useCallback(() => setAttempt((count) => count + 1), []);
  return { state, reload };
}

/** First-load placeholder, the failure card with the store's reason and a retry, or the loaded content. */
export function LoadView<T>({ load, children }: { load: Load<T>; children: (data: T) => ReactNode }) {
  const { state, reload } = load;
  if (state.status === "loading") {
    return (
      <LoadingRegion>
        {SKELETON_ROWS.map((row) => (
          <Skeleton key={row} $size="control" />
        ))}
      </LoadingRegion>
    );
  }
  if (state.status === "error") {
    return <ErrorFallback error={state.error} onRetry={reload} titleKey="admin.loadFailed" messageKey={`auth.error.${toAuthError(state.error).code}`} />;
  }
  return children(state.data);
}

/** Runs one store call at a time: error toast with the store's reason on failure, reload on success. */
export function useAction(reload: () => void): { busy: boolean; run: (action: () => Promise<void>) => Promise<boolean> } {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const run = async (action: () => Promise<void>): Promise<boolean> => {
    if (busy) return false;
    setBusy(true);
    try {
      await action();
      reload();
      return true;
    } catch (error) {
      const { code, detail } = toAuthError(error);
      toast.error({ title: `auth.error.${code}`, ...(detail ? { message: "admin.detail", messageVars: { detail } } : {}) });
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { busy, run };
}

/** A dialog's form values, started fresh every time the dialog is opened for another request. */
export function useDraft<R, D>(request: R, init: (request: R) => D): [D, (next: D) => void] {
  const [seen, setSeen] = useState(request);
  const [draft, setDraft] = useState(() => init(request));
  if (request !== seen) {
    setSeen(request);
    setDraft(init(request));
  }
  return [draft, setDraft];
}
