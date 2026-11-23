"use client";

import type { ComponentType } from "react";
import { Card, Field, Notice, Select, Stack, Text } from "@/components/ui";
import { useI18n } from "@/i18n";
import { DefinitionSummary } from "../DefinitionSummary";
import { sourceDefinition } from "../plan";
import { DATA_SOURCES, type DataSource } from "../schema";
import { sorted } from "../templates";
import { ChoiceCards, Option } from "../ui";
import type { StepProps } from "./types";

const NOT_PICKED = "";

function ViewPicker({ state, dispatch, page: { savedViews } }: StepProps) {
  const { t } = useI18n();
  if (savedViews.length === 0) return <Notice>{t("export.source.noViews")}</Notice>;
  return (
    <Field label={t("export.source.pickView")}>
      {(id) => (
        <Select id={id} required value={state.otherViewId ?? NOT_PICKED} onChange={(event) => dispatch({ type: "pickView", id: event.target.value })}>
          <Option value={NOT_PICKED} disabled>
            {t("export.source.choose")}
          </Option>
          {savedViews.map((saved) => (
            <Option key={saved.id} value={saved.id}>
              {saved.name}
            </Option>
          ))}
        </Select>
      )}
    </Field>
  );
}

function TemplatePicker({ state, dispatch, page, defaults, fileTemplates }: StepProps) {
  const { t } = useI18n();
  const templates = sorted(page.templates);
  if (templates.length === 0) return <Notice>{t("export.source.noTemplates")}</Notice>;
  const apply = (id: string) => {
    const template = templates.find((candidate) => candidate.id === id);
    if (template) dispatch({ type: "applyTemplate", template, fileTemplates, defaults });
  };
  return (
    <Field label={t("export.source.pickTemplate")}>
      {(id) => (
        <Select id={id} required value={state.templateId ?? NOT_PICKED} onChange={(event) => apply(event.target.value)}>
          <Option value={NOT_PICKED} disabled>
            {t("export.source.choose")}
          </Option>
          {templates.map((template) => (
            <Option key={template.id} value={template.id}>
              {template.isDefault ? t("export.templates.defaultName", { name: template.name }) : template.name}
            </Option>
          ))}
        </Select>
      )}
    </Field>
  );
}

function CurrentPanel({ page: { report, view } }: StepProps) {
  return (
    <Card>
      <DefinitionSummary fields={report.fields} columns={view.columns} sorts={view.sorts} filters={view.filters} />
    </Card>
  );
}

function CustomPanel() {
  const { t } = useI18n();
  return <Notice $tone="info">{t("export.source.customInfo")}</Notice>;
}

const PANELS: Partial<Record<DataSource, ComponentType<StepProps>>> = {
  current: CurrentPanel,
  other_view: ViewPicker,
  template: TemplatePicker,
  custom: CustomPanel,
};

export function SourceStep(props: StepProps) {
  const { t } = useI18n();
  const { state, dispatch, page, defaults, fileTemplates } = props;
  const definition = sourceDefinition(state, page);
  const Panel = PANELS[state.source];
  // "This view as saved" only makes sense while the page is showing a saved view.
  const showsSavedView = page.savedViews.some((saved) => saved.id === page.currentViewId);
  const sources = DATA_SOURCES.filter((source) => source !== "current_by_definition" || showsSavedView);

  const setSource = (source: DataSource) => {
    dispatch({ type: "setSource", source, defaults });
    // The report's default template, when it has one, is picked straight away.
    const preset = page.templates.find((template) => template.isDefault);
    if (source === "template" && preset) dispatch({ type: "applyTemplate", template: preset, fileTemplates, defaults });
  };

  return (
    <>
      <ChoiceCards
        legend={t("export.source.legend")}
        name="export-source"
        value={state.source}
        options={sources.map((source) => ({
          value: source,
          title: t(`export.source.${source}`),
          description: t(`export.source.${source}.desc`),
        }))}
        onChange={setSource}
      />
      {Panel ? <Panel {...props} /> : null}
      {definition ? (
        <Card>
          <Stack $gap="sm">
            <Text $medium $size="sm">
              {definition.name}
            </Text>
            <DefinitionSummary
              fields={page.report.fields}
              columns={definition.columns.length > 0 ? definition.columns : page.view.columns}
              sorts={definition.sorts}
              filters={definition.filters}
            />
          </Stack>
        </Card>
      ) : null}
    </>
  );
}
