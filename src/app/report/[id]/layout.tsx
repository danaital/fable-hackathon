import type { ReactNode } from "react";
import { getReport } from "@/data/reports";
import { ReportShell } from "@/features/report/ReportShell";

// The shell lives in the layout so the current view (filters, sorts, columns) survives switching tabs.
export default async function ReportLayout({ children, params }: { children: ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ReportShell report={getReport(id) ?? null}>{children}</ReportShell>;
}
