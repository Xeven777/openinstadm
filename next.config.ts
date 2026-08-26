import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["tunnel.auradevs.co"],
  // Cache Components: enables `use cache`/`cacheLife` and Partial Prerendering.
  // With it, `dynamic`/`revalidate`/`fetchCache` segment configs are replaced
  // by the new caching model — data fetching is dynamic by default and the
  // framework prerenders a static shell that streams dynamic content into.
  cacheComponents: true,
  // Client cache TTL for dynamic segments (default: 0 = not cached). Without
  // this, every navigation to a user-scoped page (dashboard, settings, …) hits
  // the server and flashes the loading skeleton. 4 minutes matches the
  // server-side cacheLife windows on the dashboard/settings reads. Mutations
  // still show fresh data immediately — router.refresh() and revalidateTag()
  // clear the client cache regardless of this TTL.
  experimental: {
    staleTimes: {
      dynamic: 240,
      static: 300,
    },
    cachedNavigations: true,
  },
  images: {
    remotePatterns: [
      {
        hostname: "*",
      },
    ],
  },
  reactCompiler: true,
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
