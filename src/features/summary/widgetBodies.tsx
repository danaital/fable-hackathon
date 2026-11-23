"use client";

import { Info, Minus, TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Badge, Ltr, Notice, Stack, Text, VisuallyHidden } from "@/components/ui";
import { useReport } from "@/features/report/ReportContext";
import { useI18n, type I18nKey } from "@/i18n";
import { CardError } from "./CardFrame";
import type { WidgetConfig } from "./config";
import type { DateWindow } from "./periods";
import { Flip, PlaceBadge, RankItem, RankLabel, RankList, Separator, SummaryBox, ValueText } from "./primitives";
import type { RankingRow } from "./ranking";
import type { SummaryTools } from "./useSummary";
import type { Measure, NoticeCode } from "./values";
import type { TrendDirection, WidgetResult } from "./widgetCalc";

const ICON_SIZE = 16;
const PERCENT = 100;

interface BodyProps {
  result: WidgetResult;
  widget: WidgetConfig;
  tools: SummaryTools;
  /** True inside the enlarge dialog: lists are not height-limited there. */
  enlarged: boolean;
  /** Rows a ranking shows. */
  topN: number;
}

const NOTICE_KEY: Record<NoticeCode, I18nKey> = { mixedCurrency: "summary.notice.mixedCurrency" };
const TREND: Record<TrendDirection, { Icon: LucideIcon; key: I18nKey }> = {
  up: { Icon: TrendingUp, key: "summary.trend.up" },
  down: { Icon: TrendingDown, key: "summary.trend.down" },
  flat: { Icon: Minus, key: "summary.trend.flat" },
};
const SUMMARY_KEY: Record<"total" | "average", I18nKey> = { total: "summary.ranking.total", average: "summary.ranking.average" };

/** An info notice in place of a value: mixed currencies, a display condition that is not met, no data. */
export function ValueNotice({ children }: { children: ReactNode }) {
  return (
    <Notice $tone="info" role="status">
      <Info size={ICON_SIZE} aria-hidden />
      <Text $size="sm">{children}</Text>
    </Notice>
  );
}

function Figure({ label, measure, tools, note }: { label: string; measure: Measure; tools: SummaryTools; note?: string }) {
  return (
    <Stack $gap="xs" $grow $align="center" $justify="center">
      <Text $muted $size="sm">
        {label}
      </Text>
      <ValueText $small>
        <Ltr>{tools.formatMeasure(measure)}</Ltr>
      </ValueText>
      {note ? (
        <Text $muted $size="xs">
          {note}
        </Text>
      ) : null}
    </Stack>
  );
}

function ValueBody({ result, tools }: BodyProps) {
  if (result.kind !== "value") return null;
  return (
    <ValueText>
      <Ltr>{tools.formatMeasure(result.measure)}</Ltr>
    </ValueText>
  );
}

function DualBody({ result, widget, tools }: BodyProps) {
  if (result.kind !== "dual" || widget.type !== "dualValue") return null;
  return (
    // Grows to fill the card, so the two figures sit in the middle of it rather than under the header.
    <Stack $row $gap="lg" $align="stretch" $grow>
      <Figure label={tools.text(widget.left.title)} measure={result.left} tools={tools} />
      <Separator aria-hidden />
      <Figure label={tools.text(widget.right.title)} measure={result.right} tools={tools} />
    </Stack>
  );
}

function ComparisonBody({ result, tools }: BodyProps) {
  const { t } = useI18n();
  const { format } = useReport();
  if (result.kind !== "comparison") return null;
  const { Icon, key } = TREND[result.direction];
  const trend = t(key, { percent: format.percent(result.trendPct) });
  const span = ({ start, end }: DateWindow) => t("summary.widget.window", { start: format.date(start), end: format.date(end) });
  const sentence = t("summary.comparison.sentence", {
    current: tools.formatMeasure(result.current),
    previous: tools.formatMeasure(result.previous),
    trend,
  });
  return (
    <>
      {/* Read as one sentence; the figures below repeat it visually. */}
      <VisuallyHidden>{sentence}</VisuallyHidden>
      <Stack $gap="sm" aria-hidden>
        <Stack $row>
          <Badge $tone="neutral">
            <Flip>
              <Icon size={ICON_SIZE} />
            </Flip>
            {trend}
          </Badge>
        </Stack>
        <Stack $row $gap="lg" $align="stretch">
          <Figure label={t("summary.widget.previous")} measure={result.previous} tools={tools} note={span(result.windows.previous)} />
          <Separator />
          <Figure label={t("summary.widget.current")} measure={result.current} tools={tools} note={span(result.windows.current)} />
        </Stack>
      </Stack>
    </>
  );
}

function RankingBody({ result, widget, tools, enlarged, topN }: BodyProps) {
  const { t } = useI18n();
  const { format } = useReport();
  if (result.kind !== "ranking" || widget.type !== "ranking") return null;
  const { rows, summary, summaryValue, unit } = result.ranking;
  if (rows.length === 0) return <ValueNotice>{t("summary.noData")}</ValueNotice>;

  const shown = rows.slice(0, topN);
  const top = shown[0].value;
  const suffix = widget.valueSuffix ? tools.text(widget.valueSuffix) : "";
  const label = (row: RankingRow) => (row.key === null ? t("summary.ranking.unknown") : tools.labelFor(row.key, widget.labelField));

  return (
    <Stack $gap="sm">
      <Stack $row $wrap $gap="md" $align="stretch">
        <SummaryBox>
          <Text $muted $size="sm">
            {t(SUMMARY_KEY[summary])}
          </Text>
          <ValueText $small>
            <Ltr>{tools.formatMeasure({ value: summaryValue, unit })}</Ltr>
          </ValueText>
        </SummaryBox>
        <RankList $tall={enlarged}>
          {shown.map((row) => (
            <RankItem key={String(row.key)}>
              <PlaceBadge $place={row.position} $share={top > 0 ? row.value / top : 0}>
                <Ltr>{row.position}</Ltr>
              </PlaceBadge>
              <RankLabel>{label(row)}</RankLabel>
              <Text $medium>
                <Ltr>{tools.formatMeasure({ value: row.value, unit })}</Ltr> {suffix}
              </Text>
              {row.share === null ? null : (
                <Text $muted $size="xs">
                  {t("summary.ranking.share", { percent: format.percent(row.share * PERCENT) })}
                </Text>
              )}
            </RankItem>
          ))}
        </RankList>
      </Stack>
      {rows.length < topN ? (
        <Stack $row $gap="xs">
          <Info size={ICON_SIZE} aria-hidden />
          <Text $muted $size="xs">
            {t("summary.ranking.fewer", { count: rows.length, topN })}
          </Text>
        </Stack>
      ) : null}
    </Stack>
  );
}

function NoticeBody({ result }: BodyProps) {
  const { t } = useI18n();
  if (result.kind !== "notice") return null;
  return <ValueNotice>{t(NOTICE_KEY[result.code], { detail: result.detail })}</ValueNotice>;
}

const BODIES: Record<WidgetResult["kind"], (props: BodyProps) => ReactNode> = {
  value: ValueBody,
  dual: DualBody,
  comparison: ComparisonBody,
  ranking: RankingBody,
  notice: NoticeBody,
  error: CardError,
};

/** The value area of a widget card, by the kind of its result. */
export function WidgetBody(props: BodyProps) {
  const Body = BODIES[props.result.kind];
  return <Body {...props} />;
}
