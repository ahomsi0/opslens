"use client";

import { motion } from "framer-motion";
import {
  Activity,
  Bell,
  Brain,
  GitBranch,
  LineChart,
  Network,
} from "lucide-react";

const features = [
  {
    icon: Activity,
    title: "Real-time everything",
    desc: "WebSocket-powered metrics with sub-second resolution. CPU, RAM, network, request rate, error budget — all flowing live, never stale.",
  },
  {
    icon: Brain,
    title: "AI that actually understands",
    desc: "Don't read logs — ask. Our model correlates deploys, traces, and metrics to explain incidents in plain English the moment they happen.",
  },
  {
    icon: GitBranch,
    title: "Deploy-aware history",
    desc: "Every metric is tagged with the commit, branch, and author behind it. Rollback markers, build durations, and diffs — one click away.",
  },
  {
    icon: Bell,
    title: "Alerts with judgment",
    desc: "Slack, webhook, email. Opslens only pages you for signals that matter — cold starts, SSL expiry, schema drift, real downtime.",
  },
  {
    icon: Network,
    title: "Multi-provider, one view",
    desc: "Vercel deploys, Render workers, Railway services, Neon branches — fused into a single timeline. No more tab-switching at 2 AM.",
  },
  {
    icon: LineChart,
    title: "Charts you'll actually look at",
    desc: "Animated, accessible, glanceable. Uptime heatmaps, regional latency maps, p50/p95/p99 overlays. Built for engineers, not dashboards.",
  },
];

export function Features() {
  return (
    <section id="features" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <SectionHeader
          eyebrow="Features"
          title="Built for engineers who ship on Fridays."
          subtitle="Every feature was sharpened by sitting next to on-call engineers, watching them try to debug downtime at 3 AM. We removed everything else."
        />

        <div className="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px rounded-2xl border border-[var(--color-border)] bg-[var(--color-border)] overflow-hidden">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, delay: i * 0.04 }}
              className="group relative bg-[var(--color-surface)] p-7 transition-colors hover:bg-[var(--color-bg-elevated)]"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-[var(--color-accent)]">
                <f.icon className="h-4 w-4" />
              </div>
              <h3 className="mt-4 text-base font-semibold tracking-tight">
                {f.title}
              </h3>
              <p className="mt-2 text-sm text-[var(--color-fg-muted)] leading-relaxed">
                {f.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  subtitle,
  center = true,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  center?: boolean;
}) {
  return (
    <div className={center ? "text-center" : ""}>
      {eyebrow && (
        <div
          className={`inline-flex items-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 text-xs text-[var(--color-fg-muted)] ${
            center ? "" : "mb-3"
          }`}
        >
          {eyebrow}
        </div>
      )}
      <h2
        className={`mt-4 text-balance text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight ${
          center ? "mx-auto max-w-3xl" : ""
        }`}
      >
        {title}
      </h2>
      {subtitle && (
        <p
          className={`mt-4 text-pretty text-base sm:text-lg text-[var(--color-fg-muted)] ${
            center ? "mx-auto max-w-2xl" : ""
          }`}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}
