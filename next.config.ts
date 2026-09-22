import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["esptool-js"],
  outputFileTracingIncludes: {
    "/changelog": ["./docs/changelog.md"],
  },
};

export default nextConfig;
