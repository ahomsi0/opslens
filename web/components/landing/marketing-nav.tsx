"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { OpslensLogo } from "@/components/landing/opslens-logo";
import { ArrowUpRight } from "lucide-react";

export function MarketingNav() {
  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="sticky top-0 z-40 w-full"
    >
      <div className="mx-auto max-w-7xl px-6">
        <div className="mt-4 flex items-center justify-between rounded-xl glass border px-4 py-2.5">
          <Link href="/" className="flex items-center gap-2 group">
            <OpslensLogo className="h-6 w-6 text-[var(--color-accent)] group-hover:scale-110 transition" />
            <span className="font-semibold tracking-tight text-[var(--color-fg)]">
              Opslens
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-7 text-sm text-[var(--color-fg-muted)]">
            <a href="#features" className="hover:text-[var(--color-fg)] transition">
              Features
            </a>
            <a href="#how" className="hover:text-[var(--color-fg)] transition">
              How it works
            </a>
            <a href="#customers" className="hover:text-[var(--color-fg)] transition">
              Customers
            </a>
            <Link
              href="/dashboard"
              className="hover:text-[var(--color-fg)] transition"
            >
              Dashboard
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild size="sm">
              <Link href="/dashboard" className="gap-1">
                Open app
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </motion.header>
  );
}
