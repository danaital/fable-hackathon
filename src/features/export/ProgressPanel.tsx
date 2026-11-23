"use client";

import { Ban, CircleAlert, CircleCheck } from "lucide-react";
import { Button, Ltr, Notice, Stack, Text } from "@/components/ui";
import { useI18n } from "@/i18n";
import { ICON_SIZE, ProgressBar } from "./ui";
import type { ExportProgress } from "./useExportRunner";

interface Props {
  progress: ExportProgress;
  /** Given while the export can still be cancelled. */
  onCancel?: () => void;
}

/** Where a running export stands: stage, bar and Cancel; then "download started", "cancelled" or the error. */
export function ProgressPanel({ progress, onCancel }: Props) {
  const { t } = useI18n();
  const { stage, percent, cancelled, rowCount } = progress;

  if (stage === "error" && !cancelled) {
    // Never colour alone: an icon and the message, announced at once.
    return (
      <Notice $tone="danger" role="alert">
        <CircleAlert size={ICON_SIZE} aria-hidden />
        {t("export.stage.error")}
      </Notice>
    );
  }
  if (stage === "error") {
    return (
      <Notice role="status">
        <Ban size={ICON_SIZE} aria-hidden />
        {t("export.stage.cancelled")}
      </Notice>
    );
  }
  if (stage === "complete") {
    return (
      <Stack $gap="sm">
        <Notice $tone="success" role="status">
          <CircleCheck size={ICON_SIZE} aria-hidden />
          {t("export.stage.complete")}
        </Notice>
        {rowCount === 0 ? <Notice $tone="info">{t("export.noRows")}</Notice> : null}
      </Stack>
    );
  }
  return (
    <Stack $gap="sm">
      <Stack $row $wrap $justify="space-between" $gap="sm">
        {/* One live region for the whole run, so each new stage is announced. */}
        <Text $size="sm" role="status" aria-live="polite">
          {t(`export.stage.${stage}`)}
        </Text>
        <Text $muted $size="sm">
          <Ltr>{percent}%</Ltr>
        </Text>
      </Stack>
      <ProgressBar percent={percent} label={t("export.progress")} />
      {onCancel ? (
        <Stack $row $justify="end">
          <Button onClick={onCancel}>{t("export.cancelExport")}</Button>
        </Stack>
      ) : null}
    </Stack>
  );
}
