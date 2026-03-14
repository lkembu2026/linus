import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  typescript: {
    // Type errors are checked in development; skip during build for speed
    ignoreBuildErrors: true,
  },
  experimental: {
    optimizePackageImports: [
      "recharts",
      "lucide-react",
      "radix-ui",
      "date-fns",
    ],
  },
};

export default nextConfig;
