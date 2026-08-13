import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["tunnel.auradevs.co"],
  // Cache Components: enables `use cache`/`cacheLife` and Partial Prerendering.
  // With it, `dynamic`/`revalidate`/`fetchCache` segment configs are replaced
  // by the new caching model — data fetching is dynamic by default and the
  // framework prerenders a static shell that streams dynamic content into.
  cacheComponents: true,
  reactCompiler: true,
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
