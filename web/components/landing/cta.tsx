"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CTA() {
  return (
    <section className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.55 }}
          className="relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-10 sm:p-16 text-center"
        >
          <div className="relative">
            <h2 className="text-balance text-3xl sm:text-5xl font-semibold tracking-tight">
              Production should{" "}
              <span className="text-[var(--color-accent)]">
                explain itself.
              </span>
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-[var(--color-fg-muted)]">
              Connect your first project and start streaming live metrics in
              under two minutes.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button asChild size="lg">
                <Link href="/dashboard">
                  Open the dashboard
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
