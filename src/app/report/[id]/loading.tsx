import { ReportSkeleton } from "@/components/ui";

// Shown under the report's own header and toolbars, which live in the layout.
export default function ReportLoading() {
  return <ReportSkeleton toolbar={false} />;
}
