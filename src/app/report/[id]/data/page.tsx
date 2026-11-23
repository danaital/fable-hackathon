import { redirect } from "next/navigation";

// The report has one page (widgets, table, charts). Old /data links land on it.
export default async function ReportDataRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/report/${encodeURIComponent(id)}/summary`);
}
