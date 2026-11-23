import { About } from "@/features/about/About";
import pkg from "../../../package.json";

// The version is read on the server from package.json, so the page always shows what is deployed.
export default function AboutPage() {
  return <About version={pkg.version} />;
}
