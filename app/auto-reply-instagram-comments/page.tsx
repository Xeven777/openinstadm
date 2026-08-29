import type { Metadata } from "next";
import SeoPageShell from "@/components/seo-page-shell";
import { autoReplyInstagramCommentsPage } from "@/lib/seo-pages";

export const metadata: Metadata = {
  title: "Auto Reply Instagram Comments — Private DM + Public Reply",
  description:
    "Auto-reply Instagram comments with private DMs and optional public replies. Webhook + polling catch every comment, even viral spikes. Official Meta API, queue-backed.",
  alternates: { canonical: "/auto-reply-instagram-comments" },
  openGraph: {
    title: "Auto Reply Instagram Comments — Private DM + Public Reply",
    description:
      "Auto-reply to Instagram comments at scale: private + public replies, reconciliation sweep, full logs.",
    url: "/auto-reply-instagram-comments",
  },
};

export default function AutoReplyInstagramCommentsPage() {
  return <SeoPageShell config={autoReplyInstagramCommentsPage} />;
}
