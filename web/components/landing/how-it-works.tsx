"use client";

import { motion } from "framer-motion";
import { SectionHeader } from "./features";

const steps = [
  {
    n: "01",
    title: "Connect your stack",
    desc: "OAuth into Vercel, Render, Railway, Supabase, or Neon — or drop in a Docker target. Setup takes under 90 seconds, no agents to install.",
  },
  {
    n: "02",
    title: "Watch it stream",
    desc: "Live metrics start flowing immediately. Every deploy, every cold start, every 5xx — captured and correlated against your service map.",
  },
  {
    n: "03",
    title: "Ask the AI anything",
    desc: "When something breaks (or before it does), Opslens's assistant explains why — referencing the exact commit, query, or region at fault.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <SectionHeader
          eyebrow="How it works"
          title="From signup to first insight in under 2 minutes."
        />
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-4">
          {steps.map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.45, delay: i * 0.08 }}
              className="relative rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-7"
            >
              <div className="font-mono text-xs tracking-[0.2em] text-[var(--color-accent)]">
                {s.n}
              </div>
              <h3 className="mt-4 text-lg font-semibold tracking-tight">
                {s.title}
              </h3>
              <p className="mt-2 text-sm text-[var(--color-fg-muted)] leading-relaxed">
                {s.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
