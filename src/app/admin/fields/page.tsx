import { FieldsScreen } from "@/features/admin/FieldsScreen";

// The Reports screen links here with ?report=<id>. The value is untrusted; the screen checks it against the known reports.
export default async function AdminFieldsPage({ searchParams }: { searchParams: Promise<{ report?: string | string[] }> }) {
  const { report } = await searchParams;
  return <FieldsScreen initialReport={typeof report === "string" ? report : ""} />;
}
