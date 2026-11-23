"use client";

import { ChevronDown, ChevronUp, Plus } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { z } from "zod";
import { Badge, Button, Dialog, Notice, Paragraph, Stack, Text, VisuallyHidden } from "@/components/ui";
import { ColumnsButton } from "@/features/grid/controls";
import { useReport } from "@/features/report/ReportContext";
import type { FilterRelation } from "@/features/report/viewState";
import { useEffectiveSettings } from "@/features/settings/store";
import { useI18n, type I18nKey } from "@/i18n";
import { createLocalStore } from "@/lib/store";
import { compileRule, effectiveRelation, MIN_FILTERS_FOR_FLEX, type FilterSpec } from "./engine";
import { FieldPicker } from "./FieldPicker";
import { FilterCard } from "./FilterCard";
import { FilterChips } from "./FilterChips";
import { CardList, DebouncedInput, EmptyBox, SearchSlot, ToolbarBox } from "./parts";
import { RelationSelector } from "./RelationSelector";
import { cleared } from "./rules";
import { useFilterRates } from "./useFilterRates";

const ICON_SIZE = 16;
const NO_COLLAPSED: Record<string, boolean> = {};
// Remembered per report, in this browser.
const collapsedStore = createLocalStore("bahir.filters.collapsed", z.record(z.string(), z.boolean()), NO_COLLAPSED);

type Confirm = { kind: "removeAll" } | { kind: "flex"; rule: FilterSpec };
const CONFIRM_TEXT: Record<Confirm["kind"], { title: I18nKey; body: I18nKey }> = {
  removeAll: { title: "filters.confirm.removeAll.title", body: "filters.confirm.removeAll.body" },
  flex: { title: "filters.confirm.flex.title", body: "filters.confirm.flex.body" },
};

/** The data toolbar: search, filter actions, the AND / OR / FLEX choice and one card per filter. */
export function FilterToolbar() {
  const { t } = useI18n();
  const { report, rows, filteredRows, view, setView, format } = useReport();
  const settings = useEffectiveSettings(report.id);
  const collapsed = collapsedStore.useValue()[report.id] ?? false;
  const [picker, setPicker] = useState({ open: false, session: 0 });
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  // Set when FLEX had to give way because fewer than three filters stayed on.
  const [fallback, setFallback] = useState<FilterRelation | null>(null);
  const [now] = useState(() => new Date());
  const searchId = useId();
  const panelId = useId();

  const fields = useMemo(() => new Map(report.fields.map((field) => [field.key, field])), [report.fields]);
  const rules: readonly FilterSpec[] = view.filters;
  const ratesState = useFilterRates({ rows, fields: report.fields, filters: rules, currency: settings.currency });
  const { rates } = ratesState;
  const applied = useMemo(() => rules.filter((rule) => compileRule({ rule, fields, now, rates }) !== null).length, [rules, fields, now, rates]);
  const relation = effectiveRelation(rules, view.relation);
  const anyOn = rules.some((rule) => rule.enabled !== false);

  const setCollapsed = (value: boolean) => collapsedStore.write({ ...collapsedStore.read(), [report.id]: value });

  // Every change to the list goes through here, so FLEX falls back the moment it loses its third filter.
  const change = (transform: (filters: readonly FilterSpec[]) => FilterSpec[]) => {
    const next = view.relation === "flex" ? effectiveRelation(transform(rules), "flex") : view.relation;
    setFallback(next === view.relation ? null : next);
    setView((current) => {
      const filters = transform(current.filters);
      return { ...current, filters, relation: current.relation === "flex" ? effectiveRelation(filters, "flex") : current.relation };
    });
  };
  const update = (next: FilterSpec) => change((filters) => filters.map((rule) => (rule.id === next.id ? next : rule)));
  const drop = (target: FilterSpec) => change((filters) => filters.filter((rule) => rule.id !== target.id));
  const remove = (rule: FilterSpec) => {
    // Removing one of exactly three FLEX filters changes how the rest combine, so ask first.
    if (view.relation === "flex" && rules.length === MIN_FILTERS_FOR_FLEX) setConfirm({ kind: "flex", rule });
    else drop(rule);
  };
  const clearValues = (filters: readonly FilterSpec[]) =>
    filters.map((rule) => {
      const field = fields.get(rule.field);
      return field ? cleared(rule, field) : rule;
    });
  const confirmed = () => {
    if (confirm?.kind === "flex") drop(confirm.rule);
    if (confirm?.kind === "removeAll") change(() => []);
    setConfirm(null);
  };
  const afterRemoval = confirm?.kind === "flex" ? effectiveRelation(rules.filter((rule) => rule.id !== confirm.rule.id), "flex") : relation;

  const CollapseIcon = collapsed ? ChevronDown : ChevronUp;

  return (
    <ToolbarBox aria-label={t("filters.title")}>
      <Stack $row $wrap $gap="sm">
        <SearchSlot>
          <VisuallyHidden as="label" htmlFor={searchId}>
            {t("filters.search")}
          </VisuallyHidden>
          <DebouncedInput id={searchId} type="search" value={view.search} placeholder={t("filters.search")} onCommit={(search) => setView({ search })} />
        </SearchSlot>
        <Button $variant="primary" aria-haspopup="dialog" onClick={() => setPicker({ open: true, session: picker.session + 1 })}>
          <Plus size={ICON_SIZE} aria-hidden />
          {t("filters.add")}
        </Button>
        <ColumnsButton />
        <Button aria-expanded={!collapsed} aria-controls={panelId} onClick={() => setCollapsed(!collapsed)}>
          <CollapseIcon size={ICON_SIZE} aria-hidden />
          {t(collapsed ? "filters.expand" : "filters.collapse")}
        </Button>
      </Stack>

      <Stack $row $wrap $gap="md" $justify="space-between">
        <Text $size="sm" role="status">
          {t("filters.result", { shown: format.number(filteredRows.length), total: format.number(rows.length) })}
        </Text>
        {rules.length > 0 ? (
          <Text $muted $size="sm">
            {t("filters.count", { active: applied, total: rules.length })}
          </Text>
        ) : null}
      </Stack>

      {fallback ? (
        <Notice $tone="info" role="status">
          {t("filters.msg.flexOff", { relation: t(`filters.relation.${fallback}`) })}
        </Notice>
      ) : null}

      <Stack id={panelId} $gap="md">
        {collapsed ? (
          <Stack $row $wrap $gap="sm">
            {rules.length > 1 ? <Badge $tone="info">{t(`filters.relation.${relation}`)}</Badge> : null}
            {rules.length === 0 ? (
              <Text $muted $size="sm">
                {t("filters.summary.none")}
              </Text>
            ) : (
              <FilterChips rules={rules} fields={fields} ratesReady={rates !== null} onRemove={remove} />
            )}
          </Stack>
        ) : (
          <>
            <RelationSelector
              filters={rules}
              relation={view.relation}
              onChange={(next) => {
                setFallback(null);
                setView({ relation: next });
              }}
            />
            {rules.length > 0 ? (
              <Stack $row $wrap $gap="sm">
                <Button onClick={() => change((filters) => filters.map((rule) => ({ ...rule, enabled: !anyOn })))}>
                  {t(anyOn ? "filters.toggleAll.off" : "filters.toggleAll.on")}
                </Button>
                <Button onClick={() => change(clearValues)}>{t("filters.clearValues")}</Button>
                <Button onClick={() => setConfirm({ kind: "removeAll" })}>{t("filters.removeAll")}</Button>
              </Stack>
            ) : (
              <EmptyBox>{t("filters.empty")}</EmptyBox>
            )}
            <CardList>
              {rules.map((rule) => {
                const field = fields.get(rule.field);
                // A filter on a field this report does not have is not shown and never applies.
                if (!field) return null;
                return (
                  <FilterCard
                    key={rule.id}
                    rule={rule}
                    field={field}
                    fields={fields}
                    flex={relation === "flex"}
                    ratesState={ratesState}
                    onChange={update}
                    onRemove={() => remove(rule)}
                  />
                );
              })}
            </CardList>
          </>
        )}
      </Stack>

      <FieldPicker
        key={picker.session}
        open={picker.open}
        onClose={() => setPicker({ ...picker, open: false })}
        fields={report.fields}
        visibleKeys={view.columns}
        rules={rules}
        onApply={(next) => {
          change(() => next);
          setCollapsed(false);
        }}
      />

      <Dialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={confirm ? t(CONFIRM_TEXT[confirm.kind].title) : ""}
        footer={
          <>
            <Button onClick={() => setConfirm(null)}>{t("action.cancel")}</Button>
            <Button $variant="primary" onClick={confirmed}>
              {t("action.remove")}
            </Button>
          </>
        }
      >
        {confirm ? <Paragraph>{t(CONFIRM_TEXT[confirm.kind].body, { count: rules.length, relation: t(`filters.relation.${afterRemoval}`) })}</Paragraph> : null}
      </Dialog>
    </ToolbarBox>
  );
}
