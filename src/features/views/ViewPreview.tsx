"use client";

import { useMemo } from "react";
import { Badge, Ltr, Stack } from "@/components/ui";
import type { ReportDef } from "@/data/types";
import type { ViewState } from "@/features/report/viewState";
import { useSummaryConfig } from "@/features/summary/summaryConfig";
import { useI18n } from "@/i18n";
import { createFormatters } from "@/lib/format";
import { describeView, type PreviewSection } from "./describe";
import { Disclosure, DisclosureBody, DisclosureSummary, List, ListItem } from "./parts";

/** Sections of a described view; shared by the preview and the overwrite confirmation. */
export function useViewDescription(report: ReportDef, state: ViewState): PreviewSection[] {
  const { t, tData, locale } = useI18n();
  const config = useSummaryConfig(report.id);
  return useMemo(() => {
    const titles = (items: readonly { id: string; title: Record<typeof locale, string> }[]) =>
      new Map(items.map((item) => [item.id, item.title[locale]]));
    return describeView({
      report,
      state,
      t,
      tData,
      format: createFormatters(locale),
      widgetTitles: titles(config.widgets),
      chartTitles: titles(config.charts),
    });
  }, [report, state, t, tData, locale, config]);
}

/** Read-only list of everything a view contains. Every section starts collapsed each time it is shown. */
export function ViewPreview({ report, state }: { report: ReportDef; state: ViewState }) {
  const { t } = useI18n();
  const sections = useViewDescription(report, state);

  return (
    <Stack $gap="sm" role="group" aria-label={t("views.preview.title")}>
      {sections.map((section) => (
        <Disclosure key={section.id}>
          <DisclosureSummary>
            {section.title}{" "}
            {section.summary ? (
              <Badge>
                <Ltr>{section.summary}</Ltr>
              </Badge>
            ) : null}
          </DisclosureSummary>
          <DisclosureBody>
            <List>
              {section.items.map((item, index) => (
                <ListItem key={`${index}-${item}`}>{item}</ListItem>
              ))}
            </List>
          </DisclosureBody>
        </Disclosure>
      ))}
    </Stack>
  );
}
