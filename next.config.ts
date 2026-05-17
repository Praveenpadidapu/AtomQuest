import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    outputFileTracingIncludes: {
      '/**/*': ['./dev.db'],
    },
  },
};

export default nextConfig;

