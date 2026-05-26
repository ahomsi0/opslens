"use client";

import { motion } from "framer-motion";
import { SectionHeader } from "./features";

const quotes = [
  {
    quote:
      "Opslens told us a Render cold start was the reason our checkout flow was 800ms slow on Tuesdays — before we'd even noticed. Worth it in week one.",
    author: "Priya Shankar",
    role: "Staff Engineer, Atlasform",
  },
  {
    quote:
      "We replaced four different dashboards with Opslens. The AI explanations alone save us a senior engineer's worth of on-call exhaustion every quarter.",
    author: "Marcus Bell",
    role: "VP Engineering, Northwind Labs",
  },
  {
    quote:
      "I asked the assistant 'what changed before downtime' at 2 AM and it just… answered. Linked the bad commit. That moment sold the entire team.",
    author: "Yuki Tanaka",
    role: "Founder, Vector Studio",
  },
];

export function Testimonials() {
  return (
    <section id="customers" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <SectionHeader
          eyebrow="Loved by engineers"
          title="What teams are saying."
        />
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-5">
          {quotes.map((q, i) => (
            <motion.figure
              key={q.author}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.45, delay: i * 0.06 }}
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-7"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5 text-[var(--color-accent)] opacity-60"
                fill="currentColor"
                aria-hidden
              >
                <path d="M7 7h4v4H8c0 2 1 3 3 3v3c-4 0-6-2-6-6V7zm9 0h4v4h-3c0 2 1 3 3 3v3c-4 0-6-2-6-6V7z" />
              </svg>
              <blockquote className="mt-4 text-[15px] leading-relaxed text-[var(--color-fg)]">
                {q.quote}
              </blockquote>
              <figcaption className="mt-5 flex items-center gap-3">
                <Avatar name={q.author} />
                <div>
                  <div className="text-sm font-medium">{q.author}</div>
                  <div className="text-xs text-[var(--color-fg-muted)]">
                    {q.role}
                  </div>
                </div>
              </figcaption>
            </motion.figure>
          ))}
        </div>
      </div>
    </section>
  );
}

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");
  // deterministic hue from name
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return (
    <div
      className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold text-white"
      style={{
        background: `linear-gradient(135deg, oklch(0.65 0.15 ${h}), oklch(0.55 0.18 ${(h + 60) % 360}))`,
      }}
    >
      {initials}
    </div>
  );
}
