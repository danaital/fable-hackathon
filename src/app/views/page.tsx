import { REPORTS } from "@/data/reports";
import { MyViews } from "@/features/views/MyViews";

export default function ViewsPage() {
  return <MyViews reports={REPORTS} />;
}
