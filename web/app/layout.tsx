import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Opslens — AI-native infrastructure monitoring",
  description:
    "Realtime deployment, infrastructure, and AI-powered incident insight for modern engineering teams.",
  metadataBase: new URL("https://opslens.io"),
  openGraph: {
    title: "Opslens",
    description:
      "AI-native infrastructure monitoring built for modern dev teams.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0b0f",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link
          rel="preconnect"
          href="https://rsms.me/"
          crossOrigin="anonymous"
        />
        <link rel="stylesheet" href="https://rsms.me/inter/inter.css" />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
