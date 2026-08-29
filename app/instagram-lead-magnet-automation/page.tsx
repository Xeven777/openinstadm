import type { Metadata } from "next";
import SeoPageShell from "@/components/seo-page-shell";
import { instagramLeadMagnetAutomationPage } from "@/lib/seo-pages";

export const metadata: Metadata = {
  title: "Instagram Lead Magnet Automation — GUIDE Comments to Leads",
  description:
    "Automate Instagram lead magnets: GUIDE, CHECKLIST, PLAN comments trigger tracked DM delivery. Follow-gate, CTR, templates for creators and coaches.",
  alternates: { canonical: "/instagram-lead-magnet-automation" },
  openGraph: {
    title: "Instagram Lead Magnet Automation — GUIDE Comments to Leads",
    description:
      "Turn guide/checklist comments into tracked DM leads. Follow-gate, analytics, and templates for creator funnels.",
    url: "/instagram-lead-magnet-automation",
  },
};

export default function InstagramLeadMagnetAutomationPage() {
  return <SeoPageShell config={instagramLeadMagnetAutomationPage} />;
}
