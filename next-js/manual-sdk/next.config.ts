import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@opentelemetry/sdk-node",
    "@opentelemetry/sdk-trace-node",
  ],
};

export default nextConfig;
