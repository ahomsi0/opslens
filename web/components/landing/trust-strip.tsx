"use client";

import { motion } from "framer-motion";
import { ProviderIcon, providerLabels } from "@/components/projects/provider-icon";
import type { Provider } from "@/lib/types";

const providers: Provider[] = [
  "vercel",
  "render",
  "railway",
  "supabase",
  "neon",
  "docker",
];

export function TrustStrip() {
  return (
    <section className="relative border-y border-[var(--color-border)] bg-[var(--color-bg-elevated)]/40">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <p className="text-center text-[11px] uppercase tracking-[0.18em] text-[var(--color-fg-subtle)]">
          One pane of glass for the modern stack
        </p>
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-4"
        >
          {providers.map((p) => (
            <div
              key={p}
              className="flex items-center gap-2 text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] transition"
            >
              <ProviderIcon provider={p} className="h-5 w-5" />
              <span className="text-sm font-medium tracking-tight">
                {providerLabels[p]}
              </span>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
