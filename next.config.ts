import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // styled-components needs the compiler transform for SSR class names.
  compiler: { styledComponents: true },
};

export default nextConfig;
