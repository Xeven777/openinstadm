import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base =
    process.env.NEXTAUTH_URL?.replace(/\/$/, "") ??
    "https://openinstadm.com";

  const routes = [
    "",
    "/manychat-alternative",
    "/linkdm-alternative",
    "/chatfuel-alternative",
    "/instagram-dm-automation-agencies",
    "/instagram-comment-to-dm-templates",
    "/comment-link-automation",
    "/instagram-auto-dm",
    "/instagram-keyword-automation",
    "/auto-reply-instagram-comments",
    "/instagram-lead-magnet-automation",
    "/docs",
    "/privacy",
    "/terms",
    "/data-deletion",
    "/meta-review",
  ];

  const now = new Date();

  return routes.map((route) => ({
    url: `${base}${route || "/"}`,
    lastModified: now,
    changeFrequency: route === "" ? "daily" : "weekly",
    priority: route === "" ? 1 : route.includes("alternative") ? 0.9 : 0.8,
  }));
}
