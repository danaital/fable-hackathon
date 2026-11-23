import type { I18nKey } from "@/i18n";

export const TOAST_TYPES = ["success", "info", "warning", "error"] as const;
export type ToastType = (typeof TOAST_TYPES)[number];

/** Milliseconds. Permanent stays until closed. */
export const TOAST_DURATION = { short: 3000, medium: 5000, long: 8000, permanent: 0 } as const;
export const TOAST_LIMIT = 5;

type ToastVars = Record<string, string | number>;

export interface ToastAction {
  labelKey: I18nKey;
  onClick: () => void;
}

/** A toast holds keys, not text, so it follows a language switch while it is open. */
export interface ToastConfig {
  type: ToastType;
  title: I18nKey;
  message?: I18nKey;
  titleVars?: ToastVars;
  messageVars?: ToastVars;
  /** Milliseconds; 0 stays until closed. Default: medium, or long when there is an action. */
  duration?: number;
  action?: ToastAction;
}

export interface Toast extends ToastConfig {
  id: string;
  duration: number;
  /** Identity for de-duplication: type, keys and params, never the translated text. */
  dedupeKey: string;
}

const sorted = (vars?: ToastVars) => Object.entries(vars ?? {}).sort(([a], [b]) => a.localeCompare(b));

function dedupeKeyOf({ type, title, message, titleVars, messageVars }: ToastConfig): string {
  return JSON.stringify([type, title, message ?? "", sorted(titleVars), sorted(messageVars)]);
}

/** The toast list and its rules: newest on top, at most TOAST_LIMIT, no duplicates of a toast on screen. */
export function createToastStore() {
  let toasts: readonly Toast[] = [];
  let count = 0;
  const listeners = new Set<() => void>();

  const set = (next: readonly Toast[]) => {
    toasts = next;
    listeners.forEach((listener) => listener());
  };

  /** Returns the toast's id; for a duplicate, the id of the one already on screen. */
  const add = (config: ToastConfig): string => {
    const dedupeKey = dedupeKeyOf(config);
    const existing = toasts.find((toast) => toast.dedupeKey === dedupeKey);
    if (existing) return existing.id;
    count += 1;
    const duration = config.duration ?? (config.action ? TOAST_DURATION.long : TOAST_DURATION.medium);
    const toast: Toast = { ...config, id: `toast-${count}`, duration, dedupeKey };
    set([toast, ...toasts].slice(0, TOAST_LIMIT));
    return toast.id;
  };
  const typed = (type: ToastType) => (config: Omit<ToastConfig, "type">) => add({ ...config, type });

  return {
    add,
    success: typed("success"),
    info: typed("info"),
    warning: typed("warning"),
    error: typed("error"),
    dismiss: (id: string) => set(toasts.filter((toast) => toast.id !== id)),
    dismissAll: () => set([]),
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => toasts,
  };
}

export type ToastStore = ReturnType<typeof createToastStore>;
