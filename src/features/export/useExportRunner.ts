"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { logger } from "@/lib/logger";
import type { ExportPlan } from "./plan";
import { STAGE_PERCENT, runExport, type Stage } from "./runExport";

export interface ExportProgress {
  stage: Stage;
  percent: number;
  /** The user cancelled: a quiet end, not a failure. */
  cancelled?: boolean;
  /** Rows written, known once the file is complete. */
  rowCount?: number;
}

const RUNNING: ReadonlySet<Stage> = new Set<Stage>(["preparing", "processing", "generating", "downloading"]);

/** One export at a time, with progress and cancel. Shared by the wizard and the one-click exports. */
export function useExportRunner() {
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const controller = useRef<AbortController | null>(null);

  // Leaving the page stops an export that is still being built.
  useEffect(() => () => controller.current?.abort(), []);

  /** Resolves with the plan when a file was delivered, null when blocked, cancelled or failed. */
  const start = useCallback(async (prepare: () => ExportPlan): Promise<ExportPlan | null> => {
    if (controller.current) return null; // a second click while one export is in flight is ignored
    const abort = new AbortController();
    controller.current = abort;
    try {
      const plan = await runExport({
        prepare,
        signal: abort.signal,
        onStage: (stage) => setProgress({ stage, percent: STAGE_PERCENT[stage] }),
      });
      setProgress({ stage: "complete", percent: STAGE_PERCENT.complete, rowCount: plan.rows.length });
      return plan;
    } catch (error) {
      const cancelled = abort.signal.aborted;
      // The raw error goes to the log only (its name, never row data); the user gets a generic message.
      if (!cancelled) logger.error("export failed", { reason: error instanceof Error ? error.name : "unknown" });
      setProgress({ stage: "error", percent: STAGE_PERCENT.error, cancelled });
      return null;
    } finally {
      controller.current = null;
    }
  }, []);

  const cancel = useCallback(() => controller.current?.abort(), []);
  const reset = useCallback(() => setProgress(null), []);

  return { progress, busy: progress !== null && RUNNING.has(progress.stage), start, cancel, reset };
}
