"use client";

import { Columns3, Group, Ungroup } from "lucide-react";
import { useState } from "react";
import { Button, Checkbox, Chip, Dialog, Stack, Text, useToast } from "@/components/ui";
import { useReport } from "@/features/report/ReportContext";
import { useI18n } from "@/i18n";
import { ColumnsPanel } from "./ColumnsPanel";
import { applyColumns, type ColumnsResult } from "./columns";
import { ChipItem, ChipList } from "./panelParts";
import { GROUPABLE_TYPES } from "./prepare";
import { setColumnsPreview } from "./uiStore";

const ICON_SIZE = 16;

/** Opens the manage-columns panel. Mounted in the data toolbar; reads and writes the report view. */
export function ColumnsButton() {
  const { t } = useI18n();
  const { report, view, setView } = useReport();
  // A new session number remounts the panel, so it always opens on the view's current columns.
  const [session, setSession] = useState(0);
  const [open, setOpen] = useState(false);
  const toast = useToast();

  const close = () => {
    setOpen(false);
    setColumnsPreview(null);
  };
  const apply = (result: ColumnsResult) => {
    setView((current) => applyColumns(current, result));
    toast.success({ title: "gridx.columns.saved" });
    close();
  };

  return (
    <>
      <Button
        aria-haspopup="dialog"
        onClick={() => {
          setSession(session + 1);
          setOpen(true);
        }}
      >
        <Columns3 size={ICON_SIZE} aria-hidden />
        {t("gridx.columns.open")}
      </Button>
      <ColumnsPanel
        key={session}
        open={open}
        reportId={report.id}
        fields={report.fields}
        columns={view.columns}
        filters={view.filters}
        onApply={apply}
        onClose={close}
      />
    </>
  );
}

/** The grouping chips: add a grouping from a field list, remove one, or clear them all. Reads and writes `view.groupBy`. */
export function GroupingToolbar() {
  const { t } = useI18n();
  const { report, view, setView } = useReport();
  const [open, setOpen] = useState(false);

  const groupable = report.fields.filter((field) => GROUPABLE_TYPES.has(field.type));
  const active = view.groupBy.flatMap((key) => report.fields.find((field) => field.key === key) ?? []);
  const toggle = (key: string, on: boolean) =>
    setView((current) => ({
      ...current,
      groupBy: on ? [...current.groupBy.filter((existing) => existing !== key), key] : current.groupBy.filter((existing) => existing !== key),
    }));

  return (
    <Stack $row $wrap $gap="sm">
      <Button aria-haspopup="dialog" onClick={() => setOpen(true)}>
        <Group size={ICON_SIZE} aria-hidden />
        {t("gridx.group.add")}
      </Button>
      {active.length > 0 ? (
        <>
          <ChipList aria-label={t("gridx.group.active")}>
            {active.map((field) => (
              <ChipItem key={field.key}>
                <Chip onRemove={() => toggle(field.key, false)} removeLabel={t("gridx.group.remove", { column: t(field.labelKey) })}>
                  {t(field.labelKey)}
                </Chip>
              </ChipItem>
            ))}
          </ChipList>
          <Button $variant="ghost" onClick={() => setView({ groupBy: [] })}>
            <Ungroup size={ICON_SIZE} aria-hidden />
            {t("gridx.group.clear")}
          </Button>
        </>
      ) : null}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t("gridx.group.dialogTitle")}
        footer={
          <Button $variant="primary" onClick={() => setOpen(false)}>
            {t("action.done")}
          </Button>
        }
      >
        <Text $muted $size="sm">
          {t(groupable.length > 0 ? "gridx.group.dialogHint" : "gridx.group.unavailable")}
        </Text>
        <Stack $gap="xs">
          {groupable.map((field) => (
            <Checkbox key={field.key} checked={view.groupBy.includes(field.key)} onChange={(on) => toggle(field.key, on)}>
              {t(field.labelKey)}
            </Checkbox>
          ))}
        </Stack>
      </Dialog>
    </Stack>
  );
}
