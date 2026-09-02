import type { Metadata } from "next";
import SeoPageShell from "@/components/seo-page-shell";
import { instagramAutoDmPage } from "@/lib/seo-pages";

export const metadata: Metadata = {
  title: "Instagram Auto DM — Auto Reply to Comments in Seconds",
  description:
    "Free open-source Instagram Auto DM: keyword comments trigger instant private replies with tracked links. Posts, reels, multi-account, official Meta API.",
  alternates: { canonical: "/instagram-auto-dm" },
  openGraph: {
    title: "Instagram Auto DM — Auto Reply to Comments in Seconds",
    description:
      "Instagram Auto DM via official Meta private replies. Tracked links, queue + polling reconciliation, no scraping.",
    url: "/instagram-auto-dm",
  },
};

export default function InstagramAutoDmPage() {
  return <SeoPageShell config={instagramAutoDmPage} />;
}
