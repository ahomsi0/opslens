"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LiveDashboardPreview } from "@/components/landing/live-dashboard-preview";

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-16 pb-24 sm:pt-24 sm:pb-32">
      <BackgroundGrid />
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-6 relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 text-xs text-[var(--color-fg-muted)]"
            >
              <Sparkles className="h-3.5 w-3.5 text-[var(--color-accent)]" />
              AI-native infrastructure intelligence
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.05 }}
              className="mt-5 text-balance text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight leading-[1.05]"
            >
              Production telemetry,{" "}
              <span className="text-[var(--color-accent)]">
                explained by AI.
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.12 }}
              className="mt-5 text-pretty text-base sm:text-lg text-[var(--color-fg-muted)] max-w-xl"
            >
              Opslens monitors every deploy, every container, every cold
              start — then tells you in plain English why your latency just
              doubled. One dashboard for Vercel, Render, Railway, Supabase,
              Neon, and Docker.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.18 }}
              className="mt-8 flex flex-wrap items-center gap-3"
            >
              <Button asChild size="lg">
                <Link href="/dashboard">
                  Start monitoring free
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href="#how">See how it works</a>
              </Button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.45, duration: 0.6 }}
              className="mt-8 flex items-center gap-6 text-xs text-[var(--color-fg-subtle)]"
            >
              <span className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-[oklch(0.78_0.16_155)] pulse-dot" />
                12,400+ deploys monitored this week
              </span>
              <span className="hidden sm:inline">No credit card required</span>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-6 relative"
          >
            <LiveDashboardPreview />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// SVG-based grid pattern. Uses an SVG <pattern> instead of CSS
// linear-gradient so the page is gradient-free.
function BackgroundGrid() {
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern
          id="bg-grid"
          width="56"
          height="56"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M 56 0 L 0 0 0 56"
            fill="none"
            stroke="oklch(0.295 0.018 260)"
            strokeWidth="1"
            opacity="0.5"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#bg-grid)" />
    </svg>
  );
}
