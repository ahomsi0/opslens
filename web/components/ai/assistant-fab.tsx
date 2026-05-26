"use client";

import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

export function AssistantFab({ onClick }: { onClick: () => void }) {
  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.5, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      onClick={onClick}
      className="group fixed bottom-6 right-6 z-30 inline-flex items-center gap-2 rounded-full border border-[oklch(0.65_0.22_350/0.5)] glass-strong px-4 py-2.5 shadow-2xl hover:border-[oklch(0.65_0.22_350)] transition"
      aria-label="Open AI assistant"
    >
      <span className="relative flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-accent-2)]">
        <Sparkles className="h-3 w-3 text-white" />
      </span>
      <span className="text-sm font-medium text-[var(--color-fg)]">
        Ask AI
      </span>
      <kbd className="hidden sm:inline-flex rounded border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-1.5 py-0.5 text-[10px] font-mono text-[var(--color-fg-muted)]">
        ⌘K
      </kbd>
    </motion.button>
  );
}
