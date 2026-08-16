import type { Metadata } from "next";
import "./globals.css";
import "goey-toast/styles.css";
import { Geist } from "next/font/google";
import GooeyToasterMount from "@/components/goey-toaster";
import QueryProvider from "@/lib/query/provider";
import { ThemeProvider } from "@/components/theme-provider";

export const metadata: Metadata = {
  title: "OpenInstaDM - Open source Instagram comment-to-DM automation",
  description:
    "A free, self-hosted ManyChat alternative. Send an Instagram DM automatically when someone comments a keyword on your post or reel, using the official Meta API.",
  keywords: [
    "instagram automation",
    "comment to DM",
    "instagram private replies",
    "social commerce",
    "manychat alternative",
  ],
};

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={"min-h-full antialiased " + geist.className}>
        <QueryProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            {children}
            {/* Toast mount — must be inside ThemeProvider so it follows the theme. */}
            <GooeyToasterMount />
          </ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
