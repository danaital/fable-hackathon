"use client";

import { useMemo } from "react";
import { useI18n } from "@/i18n";
import { createFormatters, type Formatters } from "@/lib/format";
import { useEffectiveSettings } from "./store";

/** Formatters built from the effective formatting settings (the report's overrides when a report id is given). */
export function useFormatters(reportId?: string): Formatters {
  const { locale } = useI18n();
  const { formatting } = useEffectiveSettings(reportId);
  return useMemo(() => createFormatters(locale, formatting), [locale, formatting]);
}
