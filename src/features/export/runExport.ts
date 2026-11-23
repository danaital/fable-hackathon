import { CSV_MIME, buildCsv } from "./csv";
import type { ExportPlan } from "./plan";
import type { ExportFormat } from "./schema";
import { XLSX_MIME, buildWorkbook } from "./workbook";

export const STAGES = ["preparing", "processing", "generating", "downloading", "complete", "error"] as const;
export type Stage = (typeof STAGES)[number];

// Tunable checkpoints, not a contract.
export const STAGE_PERCENT: Record<Stage, number> = { preparing: 0, processing: 20, generating: 60, downloading: 90, complete: 100, error: 0 };
const REVOKE_DELAY_MS = 1000;

const GENERATORS: Record<ExportFormat, (plan: ExportPlan) => Promise<Blob>> = {
  csv: async (plan) => new Blob([buildCsv(plan)], { type: CSV_MIME }),
  xlsx: async (plan) => {
    // Loaded on demand: the spreadsheet library is large and only needed once someone exports.
    const exceljs = await import("exceljs");
    const { Workbook } = exceljs.default ?? exceljs;
    const workbook = new Workbook();
    buildWorkbook(workbook, plan);
    return new Blob([new Uint8Array(await workbook.xlsx.writeBuffer())], { type: XLSX_MIME });
  },
};

function download(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  // Revoking in the same tick cancels the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
}

/** Lets the browser paint the progress bar and handle a Cancel click between stages. */
const pause = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

interface RunInput {
  /** Filters, sorts and resolves the plan; runs inside the "processing" stage. */
  prepare: () => ExportPlan;
  signal: AbortSignal;
  onStage: (stage: Stage) => void;
  /** Hands the finished file to the user. Replaceable so tests need no browser. */
  deliver?: (blob: Blob, fileName: string) => void;
}

/**
 * Builds the file in the browser and hands it over, reporting each stage.
 * Cancel is checked between stages; work inside one stage (such as writing the workbook) cannot be interrupted.
 * Rejects when cancelled or failed; no file is delivered in either case.
 */
export async function runExport({ prepare, signal, onStage, deliver = download }: RunInput): Promise<ExportPlan> {
  const enter = async (stage: Stage) => {
    signal.throwIfAborted();
    onStage(stage);
    await pause();
    signal.throwIfAborted();
  };
  await enter("preparing");
  await enter("processing");
  const plan = prepare();
  await enter("generating");
  const blob = await GENERATORS[plan.format](plan);
  await enter("downloading");
  deliver(blob, `${plan.fileName}.${plan.format}`);
  onStage("complete");
  return plan;
}
