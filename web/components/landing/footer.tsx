import Link from "next/link";
import { OpslensLogo } from "@/components/landing/opslens-logo";

export function Footer() {
  return (
    <footer className="border-t border-[var(--color-border)] bg-[var(--color-bg-elevated)]/40">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <Link href="/" className="inline-flex items-center gap-2">
            <OpslensLogo className="h-6 w-6 text-[var(--color-accent)]" />
            <span className="font-semibold tracking-tight">Opslens</span>
          </Link>
          <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-[var(--color-fg-muted)]">
            <a href="#features" className="hover:text-[var(--color-fg)] transition">
              Features
            </a>
            <a href="#how" className="hover:text-[var(--color-fg)] transition">
              How it works
            </a>
            <a href="#customers" className="hover:text-[var(--color-fg)] transition">
              Customers
            </a>
            <Link href="/dashboard" className="hover:text-[var(--color-fg)] transition">
              Dashboard
            </Link>
          </nav>
        </div>
        <div className="mt-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-t border-[var(--color-border)] pt-6">
          <p className="text-xs text-[var(--color-fg-subtle)]">
            © {new Date().getFullYear()} Opslens Labs, Inc.
          </p>
          <p className="text-xs font-mono text-[var(--color-fg-subtle)]">
            built for engineers, by engineers.
          </p>
        </div>
      </div>
    </footer>
  );
}
