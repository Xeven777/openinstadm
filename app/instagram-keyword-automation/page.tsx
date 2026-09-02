import type { Metadata } from "next";
import SeoPageShell from "@/components/seo-page-shell";
import { instagramKeywordAutomationPage } from "@/lib/seo-pages";

export const metadata: Metadata = {
  title: "Instagram Keyword Automation for Comment-to-DM",
  description:
    "Instagram keyword automation: turn LINK, SHOP, GUIDE, PRICE, WAITLIST comments into tracked private replies. Exact/phrase matching, analytics, logs.",
  alternates: { canonical: "/instagram-keyword-automation" },
  openGraph: {
    title: "Instagram Keyword Automation for Comment-to-DM",
    description:
      "Turn high-intent Instagram keywords into tracked DMs with campaign analytics and agency templates.",
    url: "/instagram-keyword-automation",
  },
};

export default function InstagramKeywordAutomationPage() {
  return <SeoPageShell config={instagramKeywordAutomationPage} />;
}
