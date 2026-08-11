import type { Metadata } from "next";
import "./globals.css";
import { Inter_Tight } from "next/font/google";

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

const inter = Inter_Tight({ subsets: ["latin"], variable: "--font-sans" });

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full dark">
      <body
        className={
          "min-h-full bg-background text-foreground font-sans antialiased " +
          inter.className
        }
      >
        {children}
      </body>
    </html>
  );
}
