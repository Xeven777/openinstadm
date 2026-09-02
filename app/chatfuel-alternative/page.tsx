import type { Metadata } from "next";
import SeoPageShell from "@/components/seo-page-shell";
import { chatfuelAlternativePage } from "@/lib/seo-pages";

export const metadata: Metadata = {
  title: "Chatfuel Alternative for Instagram Comment-to-DM",
  description:
    "A lean, open-source Chatfuel alternative for Instagram keyword comments to DMs. No flow builder — just campaigns, tracked links, and logs via the official Meta API.",
  alternates: { canonical: "/chatfuel-alternative" },
  openGraph: {
    title: "Chatfuel Alternative for Instagram Comment-to-DM",
    description:
      "Focused Chatfuel alternative: Instagram campaigns, tracked links, and DM logs without the heavy bot builder.",
    url: "/chatfuel-alternative",
  },
};

export default function ChatfuelAlternativePage() {
  return <SeoPageShell config={chatfuelAlternativePage} />;
}
