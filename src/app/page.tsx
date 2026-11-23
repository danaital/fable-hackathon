import { REPORTS } from "@/data/reports";
import { Explore } from "@/features/explore/Explore";

export default function HomePage() {
  return <Explore reports={REPORTS} />;
}
