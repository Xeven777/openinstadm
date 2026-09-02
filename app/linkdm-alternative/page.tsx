import type { Metadata } from "next";
import SeoPageShell from "@/components/seo-page-shell";
import { linkdmAlternativePage } from "@/lib/seo-pages";

export const metadata: Metadata = {
  title: "LinkDM Alternative — Open-Source Instagram Comment-to-DM",
  description:
    "OpenInstaDM is the open-source LinkDM alternative: keyword comments trigger tracked private replies via the official Meta API. Self-hostable, no per-DM markups.",
  alternates: { canonical: "/linkdm-alternative" },
  openGraph: {
    title: "LinkDM Alternative — Open-Source Instagram Comment-to-DM",
    description:
      "Self-hostable LinkDM alternative with tracked links, campaign analytics, and agency reports. Official Meta API.",
    url: "/linkdm-alternative",
  },
};

export default function LinkDMAlternativePage() {
  return <SeoPageShell config={linkdmAlternativePage} />;
}
