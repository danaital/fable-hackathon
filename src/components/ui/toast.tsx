"use client";

import { CircleCheck, CircleX, Info, TriangleAlert, X, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import styled, { css, keyframes } from "styled-components";
import { useI18n } from "@/i18n";
import type { ToneName } from "@/styles/theme";
import { Button, Stack, Text } from "./index";
import { createToastStore, type Toast, type ToastStore, type ToastType } from "./toastQueue";

export { TOAST_DURATION } from "./toastQueue";
export type { ToastAction, ToastConfig, ToastType } from "./toastQueue";

const ICON_SIZE = 20;
const CLOSE_ICON_SIZE = 16;
const SLIDE_MS = 200;
const TYPE_BAR = "4px";
const PROGRESS_BAR = "3px";
// Only used by browsers without the popover API; with it the toasts sit in the top layer.
const FALLBACK_LAYER = 1000;
const NO_TOASTS: readonly Toast[] = [];

// Type is never shown by color alone: each has its own icon, and the title states the outcome.
const TYPE_ICON: Record<ToastType, LucideIcon> = { success: CircleCheck, info: Info, warning: TriangleAlert, error: CircleX };
const TYPE_TONE: Record<ToastType, ToneName> = { success: "success", info: "info", warning: "warning", error: "danger" };
// Problems are announced at once; good news waits for a pause.
const TYPE_ROLE: Record<ToastType, "status" | "alert"> = { success: "status", info: "status", warning: "alert", error: "alert" };

const store = createToastStore();
export type ToastApi = Omit<ToastStore, "subscribe" | "getSnapshot">;

/** add, success, info, warning, error (each returns the toast id), dismiss(id) and dismissAll. Titles and messages are i18n keys. */
export function useToast(): ToastApi {
  return store;
}

const slideIn = keyframes`
  from { opacity: 0; transform: translateX(var(--toast-from)); }
  to { opacity: 1; transform: translateX(0); }
`;

const drain = keyframes`
  from { inline-size: 100%; }
  to { inline-size: 0; }
`;

// Resets the browser's popover box so the region is only a positioned, click-through stack.
const Region = styled.div`
  ${({ theme: { color, size, space, bp } }) => css`
    position: fixed;
    inset: auto;
    inset-block-start: ${space.lg};
    inset-inline-end: ${space.lg};
    z-index: ${FALLBACK_LAYER};
    display: flex;
    flex-direction: column;
    gap: ${space.sm};
    inline-size: min(${size.toast}, calc(100vw - 2 * ${space.lg}));
    margin: 0;
    padding: 0;
    border: 0;
    overflow: visible;
    background: transparent;
    color: ${color.text};
    pointer-events: none;
    @media (max-width: ${bp.mobile}) {
      inset-inline: ${space.lg};
      inline-size: auto;
    }
  `}
`;

const Box = styled.div<{ $tone: ToneName }>`
  ${({ theme: { color, font, radius, shadow, space, bp }, $tone }) => css`
    --toast-from: 100%;
    position: relative;
    display: flex;
    align-items: flex-start;
    gap: ${space.md};
    padding: ${space.md};
    overflow: hidden;
    border: 1px solid ${color.border};
    border-inline-start: ${TYPE_BAR} solid ${color[$tone].fg};
    border-radius: ${radius.md};
    background: ${color.surface};
    box-shadow: ${shadow.md};
    pointer-events: auto;
    animation: ${slideIn} ${SLIDE_MS}ms ease-out;
    [dir="rtl"] & {
      --toast-from: -100%;
    }
    & > svg {
      flex: none;
      margin-block-start: ${space.xs};
      color: ${color[$tone].fg};
    }
    @media (max-width: ${bp.mobile}) {
      padding: ${space.sm};
      font-size: ${font.size.sm};
    }
  `}
`;

const Progress = styled.span<{ $duration: number; $paused: boolean }>`
  ${({ theme: { color }, $duration, $paused }) => css`
    position: absolute;
    inset-block-end: 0;
    inset-inline-start: 0;
    block-size: ${PROGRESS_BAR};
    background: ${color.textMuted};
    animation: ${drain} ${$duration}ms linear forwards;
    animation-play-state: ${$paused ? "paused" : "running"};
    @media (prefers-reduced-motion: reduce) {
      display: none;
    }
  `}
`;

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const { t } = useI18n();
  const { id, type, duration, action } = toast;
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const paused = hovered || focused;
  const remaining = useRef(duration);
  const Icon = TYPE_ICON[type];

  // The timer stops while the pointer or keyboard focus is on the toast and resumes with the time that was left.
  useEffect(() => {
    if (duration <= 0 || paused) return;
    const started = Date.now();
    const timer = window.setTimeout(() => onDismiss(id), remaining.current);
    return () => {
      window.clearTimeout(timer);
      remaining.current -= Date.now() - started;
    };
  }, [duration, id, paused, onDismiss]);

  return (
    <Box
      role={TYPE_ROLE[type]}
      $tone={TYPE_TONE[type]}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(event) => setFocused(event.currentTarget.contains(event.relatedTarget))}
    >
      <Icon size={ICON_SIZE} aria-hidden />
      <Stack $gap="xs" $grow $align="start">
        <Text $medium>{t(toast.title, toast.titleVars)}</Text>
        {toast.message ? (
          <Text $muted $size="sm">
            {t(toast.message, toast.messageVars)}
          </Text>
        ) : null}
        {action ? (
          <Button
            onClick={() => {
              action.onClick();
              onDismiss(id);
            }}
          >
            {t(action.labelKey)}
          </Button>
        ) : null}
      </Stack>
      <Button $variant="ghost" $icon aria-label={t("toast.dismiss")} onClick={() => onDismiss(id)}>
        <X size={CLOSE_ICON_SIZE} aria-hidden />
      </Button>
      {duration > 0 ? <Progress aria-hidden $duration={duration} $paused={paused} /> : null}
    </Box>
  );
}

function ToastRegion() {
  const { t } = useI18n();
  const toasts = useSyncExternalStore(store.subscribe, store.getSnapshot, () => NO_TOASTS);
  const region = useRef<HTMLDivElement>(null);
  const newestId = toasts[0]?.id;

  // The popover API puts the region in the top layer, above modal dialogs. A dialog that is already open
  // needs the region re-shown to get above it.
  // shortcut: while a modal dialog is open the toasts are visible but inert (they still time out); move the
  // region inside the open dialog when toasts with actions must be usable over dialogs.
  useEffect(() => {
    const element = region.current;
    if (!element || typeof element.showPopover !== "function") return;
    const isOpen = element.matches(":popover-open");
    if (!newestId) {
      if (isOpen) element.hidePopover();
      return;
    }
    if (isOpen && !document.querySelector("dialog:modal")) return;
    if (isOpen) element.hidePopover();
    element.showPopover();
  }, [newestId]);

  return (
    <Region ref={region} popover="manual" role="region" aria-label={t("toast.region")}>
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} onDismiss={store.dismiss} />
      ))}
    </Region>
  );
}

/** Mounts the toast region once, after the page, so toasts never take focus and are the last landmark. */
export function ToastProvider({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <ToastRegion />
    </>
  );
}
