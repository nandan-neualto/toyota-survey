import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Your visit. Your voice. | Toyota Experience Centre",
  description: "One minute. A few quick taps. Help shape the next Toyota Experience Centre visit.",
  manifest: "/manifest.webmanifest",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
