import type { Metadata, Viewport } from "next";
import "./globals.css";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://opslens-ah.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Opslens — AI-native infrastructure monitoring",
    template: "%s · Opslens",
  },
  description:
    "Live deployment, infrastructure, and AI-powered incident insight for modern engineering teams. One dashboard for Vercel, Render, Railway, Supabase, Neon, and Docker.",
  applicationName: "Opslens",
  keywords: [
    "infrastructure monitoring",
    "deployment dashboard",
    "AI observability",
    "Vercel monitoring",
    "Render monitoring",
    "uptime",
    "incidents",
  ],
  authors: [{ name: "Opslens" }],
  openGraph: {
    type: "website",
    siteName: "Opslens",
    title: "Opslens — AI-native infrastructure monitoring",
    description:
      "Live deployment, infrastructure, and AI-powered incident insight for modern engineering teams.",
    url: siteUrl,
  },
  twitter: {
    card: "summary_large_image",
    title: "Opslens — AI-native infrastructure monitoring",
    description:
      "Live deployment, infrastructure, and AI-powered incident insight for modern engineering teams.",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0b0f",
  width: "device-width",
  initialScale: 1,
  colorScheme: "dark",
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
