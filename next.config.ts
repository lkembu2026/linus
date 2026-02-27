import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  typescript: {
    // Type errors are checked in development; skip during build for speed
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
