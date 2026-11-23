import { redirect } from "next/navigation";
import { ADMIN_HOME } from "@/features/admin/nav";

export default function AdminIndexPage() {
  redirect(ADMIN_HOME);
}
