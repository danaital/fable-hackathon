"use client";

import { useSyncExternalStore } from "react";
import type { z } from "zod";

// shortcut: per-browser storage for favorites, saved views and settings.
// Upgrade to per-user rows in the database (with row-level security) when login lands;
// keep this interface so callers do not change.

export interface LocalStore<T> {
  read: () => T;
  write: (value: T) => void;
  /** React hook: current value, re-rendering on change (also from other tabs). */
  useValue: () => T;
}

export function createLocalStore<T>(key: string, schema: z.ZodType<T>, fallback: T): LocalStore<T> {
  const listeners = new Set<() => void>();
  let cachedRaw: string | null = null;
  let cachedValue: T = fallback;

  const readRaw = (): string | null => {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null; // storage blocked (private mode): values simply do not persist
    }
  };

  // Stored data is untrusted input: validate it, and fall back instead of crashing on bad data.
  const parse = (raw: string | null): T => {
    if (raw === null) return fallback;
    try {
      const result = schema.safeParse(JSON.parse(raw));
      return result.success ? result.data : fallback;
    } catch {
      return fallback;
    }
  };

  const read = (): T => {
    const raw = readRaw();
    if (raw !== cachedRaw) {
      cachedRaw = raw;
      cachedValue = parse(raw);
    }
    return cachedValue;
  };

  const write = (value: T): void => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      return;
    }
    listeners.forEach((listener) => listener());
  };

  const subscribe = (onChange: () => void): (() => void) => {
    listeners.add(onChange);
    window.addEventListener("storage", onChange);
    return () => {
      listeners.delete(onChange);
      window.removeEventListener("storage", onChange);
    };
  };

  return { read, write, useValue: () => useSyncExternalStore(subscribe, read, () => fallback) };
}
