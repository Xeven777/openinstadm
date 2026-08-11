import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["tunnel.auradevs.co"],
  reactCompiler: true,
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
