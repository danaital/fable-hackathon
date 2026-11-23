import { DataGrid } from "@/features/grid/DataGrid";
import { ChartGrid } from "@/features/summary/ChartGrid";
import { WidgetGrid } from "@/features/summary/WidgetGrid";

export default function ReportSummaryPage() {
  return (
    <>
      <WidgetGrid />
      <DataGrid />
      <ChartGrid />
    </>
  );
}
