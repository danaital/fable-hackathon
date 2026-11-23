"use client";

import {
  AlignCenterVertical,
  ArrowDownToLine,
  ArrowUpToLine,
  CircleHelp,
  Columns2,
  Divide,
  Equal,
  Fingerprint,
  GitCompareArrows,
  Hash,
  ListOrdered,
  Settings,
  Sigma,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { Button, Dialog, Field, Input, Text } from "@/components/ui";
import { useI18n } from "@/i18n";
import { CardFrame } from "./CardFrame";
import type { ConditionOutcome } from "./conditions";
import { DEFAULT_TOP_N, MAX_TOP_N, MIN_TOP_N, type Calculation, type ConfigFilter, type WidgetConfig, type WidgetType } from "./config";
import { ActionButton, Skeleton } from "./primitives";
import type { ExploreInput, SummaryTools } from "./useSummary";
import { ValueNotice, WidgetBody } from "./widgetBodies";
import type { WidgetResult } from "./widgetCalc";

const ICON_SIZE = 18;
const TOP_N_PLACEHOLDER = "{topN}";

/** A widget title with its "{topN}" placeholder filled by the rows shown, or dropped when no number applies. */
export function widgetTitle(title: string, shown?: number): string {
  if (shown !== undefined) return title.replace(TOP_N_PLACEHOLDER, String(shown));
  return title.replace(TOP_N_PLACEHOLDER, "").replace(/\s+/g, " ").trim();
}

const CALCULATION_ICONS: Record<Calculation, LucideIcon> = {
  count: Hash,
  unique: Fingerprint,
  sum: Sigma,
  average: Divide,
  averageRounded: Equal,
  median: AlignCenterVertical,
  minimum: ArrowDownToLine,
  maximum: ArrowUpToLine,
};
const TYPE_ICONS: Record<Exclude<WidgetType, "basicCalculation">, LucideIcon> = {
  custom: CircleHelp,
  dualValue: Columns2,
  comparison: GitCompareArrows,
  ranking: ListOrdered,
};

const iconOf = (widget: WidgetConfig) => (widget.type === "basicCalculation" ? CALCULATION_ICONS[widget.calculation] : TYPE_ICONS[widget.type]);
const clampTopN = (value: number) => Math.min(MAX_TOP_N, Math.max(MIN_TOP_N, Math.round(value) || MIN_TOP_N));

interface TopNDialogProps {
  title: string;
  value: number;
  onApply: (value: number) => void;
}

/** Gear button plus a small dialog to change how many rows a ranking shows. Kept in the card; not saved to the view. */
function TopNButton({ title, value, onApply }: TopNDialogProps) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<string | null>(null);
  const label = t("summary.ranking.settings", { title });
  const close = () => setDraft(null);

  return (
    <>
      <ActionButton $variant="ghost" $icon aria-label={label} title={label} onClick={() => setDraft(String(value))}>
        <Settings size={ICON_SIZE} aria-hidden />
      </ActionButton>
      <Dialog
        open={draft !== null}
        onClose={close}
        title={t("summary.ranking.topNTitle")}
        footer={
          <>
            <Button onClick={close}>{t("action.cancel")}</Button>
            <Button
              $variant="primary"
              onClick={() => {
                onApply(clampTopN(Number(draft)));
                close();
              }}
            >
              {t("action.apply")}
            </Button>
          </>
        }
      >
        <Field label={t("summary.ranking.topN", { min: MIN_TOP_N, max: MAX_TOP_N })}>
          {(id) => (
            <Input id={id} type="number" inputMode="numeric" min={MIN_TOP_N} max={MAX_TOP_N} value={draft ?? ""} onChange={(event) => setDraft(event.target.value)} />
          )}
        </Field>
      </Dialog>
    </>
  );
}

interface WidgetCardProps {
  widget: WidgetConfig;
  /** Null until the first calculation has run. */
  result: WidgetResult | null;
  outcome: ConditionOutcome;
  busy: boolean;
  tools: SummaryTools;
  onExplore: (input: ExploreInput) => void;
}

export function WidgetCard({ widget, result, outcome, busy, tools, onExplore }: WidgetCardProps) {
  const { t } = useI18n();
  const [topN, setTopN] = useState(widget.type === "ranking" ? widget.topN : DEFAULT_TOP_N);
  const ranked = result?.kind === "ranking" ? result.ranking.rows.slice(0, topN) : [];
  // A ranking's title names the number of rows really shown ("Top 4 agents" when only four exist).
  const title = widgetTitle(tools.text(widget.title), ranked.length || topN);
  const { drill } = widget;

  const explore = () => {
    if (!drill) return;
    // A ranking also narrows the table to the rows it lists. Merged or blank labels match no stored value, so they are left out.
    const labels = widget.type === "ranking" && !widget.mergeSuffixes?.length ? ranked.flatMap((row) => row.key ?? []) : [];
    const extraFilters: ConfigFilter[] = widget.type === "ranking" && labels.length > 0 ? [{ field: widget.labelField, operator: "in", values: labels }] : [];
    onExplore({ id: widget.id, title, drill, extraFilters });
  };

  const withheld: Partial<Record<ConditionOutcome, string>> = {
    notScoped: t("summary.condition.notScoped", {
      fields: (widget.displayCondition?.requireSingleValueOn ?? []).map(tools.fieldLabel).join(t("summary.listSeparator")),
    }),
    notMet: t("summary.condition.notMet"),
  };

  return (
    <CardFrame
      id={widget.id}
      title={title}
      icon={iconOf(widget)}
      tone={widget.tone}
      wide={widget.type === "ranking"}
      busy={busy}
      canEnlarge={result !== null && outcome === "met"}
      onExplore={drill ? explore : undefined}
      actions={widget.type === "ranking" ? <TopNButton title={title} value={topN} onApply={setTopN} /> : null}
    >
      {(enlarged) => (
        <>
          {widget.subtitle ? (
            <Text $muted $size="sm">
              {tools.text(widget.subtitle)}
            </Text>
          ) : null}
          {result === null ? <Skeleton aria-hidden /> : null}
          {result !== null && outcome !== "met" ? <ValueNotice>{withheld[outcome]}</ValueNotice> : null}
          {result !== null && outcome === "met" ? <WidgetBody result={result} widget={widget} tools={tools} enlarged={enlarged} topN={topN} /> : null}
        </>
      )}
    </CardFrame>
  );
}
