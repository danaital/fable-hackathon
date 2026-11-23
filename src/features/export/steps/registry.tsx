"use client";

import {
  ArrowUpDown,
  ChartColumn,
  Columns3,
  Eye,
  FilePen,
  FileType,
  Filter,
  Group,
  Languages,
  ListChecks,
  Palette,
  Sigma,
  type LucideIcon,
} from "lucide-react";
import type { ComponentType } from "react";
import type { I18nKey } from "@/i18n";
import type { StepId } from "../schema";
import { ChartsStep, FileNameStep, FormatStep } from "./BasicSteps";
import { FieldsStep } from "./FieldsStep";
import { FileTemplateStep } from "./FileTemplateStep";
import { FiltersStep } from "./FiltersStep";
import { GroupingStep } from "./GroupingStep";
import { ReviewStep } from "./ReviewStep";
import { SettingsStep } from "./SettingsStep";
import { SortStep } from "./SortStep";
import { SourceStep } from "./SourceStep";
import { SummaryStep } from "./SummaryStep";
import type { StepProps } from "./types";

interface StepView {
  titleKey: I18nKey;
  Icon: LucideIcon;
  Component: ComponentType<StepProps>;
}

// HOOK(currency): add the "currency" entry here once the step id exists in schema.ts.
export const STEP_VIEWS: Record<StepId, StepView> = {
  format: { titleKey: "export.step.format", Icon: FileType, Component: FormatStep },
  source: { titleKey: "export.step.source", Icon: Eye, Component: SourceStep },
  fields: { titleKey: "export.step.fields", Icon: Columns3, Component: FieldsStep },
  filters: { titleKey: "export.step.filters", Icon: Filter, Component: FiltersStep },
  sort: { titleKey: "export.step.sort", Icon: ArrowUpDown, Component: SortStep },
  summary: { titleKey: "export.step.summary", Icon: Sigma, Component: SummaryStep },
  grouping: { titleKey: "export.step.grouping", Icon: Group, Component: GroupingStep },
  charts: { titleKey: "export.step.charts", Icon: ChartColumn, Component: ChartsStep },
  settings: { titleKey: "export.step.settings", Icon: Languages, Component: SettingsStep },
  fileName: { titleKey: "export.step.fileName", Icon: FilePen, Component: FileNameStep },
  fileTemplate: { titleKey: "export.step.fileTemplate", Icon: Palette, Component: FileTemplateStep },
  review: { titleKey: "export.step.review", Icon: ListChecks, Component: ReviewStep },
};
