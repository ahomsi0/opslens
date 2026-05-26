"use client";

import { motion } from "framer-motion";
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  Gauge,
} from "lucide-react";
import type { ProjectSummary } from "@/lib/types";
import { formatMs, formatPercent } from "@/lib/format";

export function StatRow({ projects }: { projects: ProjectSummary[] }) {
  const total = projects.length;
  const healthy = projects.filter((p) => p.status === "healthy").length;
  const incidents = projects.reduce((a, p) => a + p.activeIncidents, 0);
  const p95s = projects
    .map((p) => p.latencyP95Ms)
    .filter((v) => v > 0)
    .sort((a, b) => a - b);
  const medianP95 = p95s.length
    ? p95s[Math.floor(p95s.length / 2)]
    : 0;
  const uptimes = projects.map((p) => p.uptimePct);
  const fleetUptime = uptimes.length
    ? uptimes.reduce((a, b) => a + b, 0) / uptimes.length
    : 100;

  const cards = [
    {
      icon: Boxes,
      label: "Projects",
      value: String(total),
      tone: "default" as const,
    },
    {
      icon: CheckCircle2,
      label: "Healthy",
      value: `${healthy} / ${total}`,
      tone: healthy === total ? "good" : ("warn" as const),
    },
    {
      icon: Gauge,
      label: "Median p95",
      value: medianP95 ? formatMs(medianP95) : "—",
      tone: "default" as const,
    },
    {
      icon: AlertTriangle,
      label: "Active incidents",
      value: String(incidents),
      tone: incidents > 0 ? ("bad" as const) : ("good" as const),
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="grid grid-cols-2 md:grid-cols-4 gap-3"
    >
      {cards.map((c, i) => (
        <div
          key={c.label}
          className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 noise"
        >
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-[var(--color-fg-subtle)]">
            <c.icon className="h-3.5 w-3.5" />
            {c.label}
          </div>
          <div
            className={`mt-2 font-mono text-2xl tabular-nums ${
              c.tone === "bad"
                ? "text-[oklch(0.82_0.18_25)]"
                : c.tone === "warn"
                  ? "text-[oklch(0.88_0.14_80)]"
                  : c.tone === "good"
                    ? "text-[oklch(0.85_0.14_155)]"
                    : "text-[var(--color-fg)]"
            }`}
          >
            {c.value}
          </div>
          {i === 1 && (
            <div className="mt-1 text-[10px] text-[var(--color-fg-subtle)] font-mono">
              fleet {formatPercent(fleetUptime, 2)}
            </div>
          )}
        </div>
      ))}
    </motion.div>
  );
}
