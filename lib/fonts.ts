import { DM_Serif_Display, Funnel_Sans } from "next/font/google";

const funnelSans = Funnel_Sans({ subsets: ["latin"], variable: "--font-sans" });
const dmSerif = DM_Serif_Display({
  subsets: ["latin"],
  style: "italic",
  weight: "400",
});

export { funnelSans, dmSerif };
