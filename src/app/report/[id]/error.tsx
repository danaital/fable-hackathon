"use client";

import { RouteError, type RouteErrorProps } from "@/components/ui";

// Catches the report's pages (widgets, table, charts); the report header and toolbars above stay usable.
export default function ReportError(props: RouteErrorProps) {
  return <RouteError {...props} titleKey="error.report.title" />;
}
