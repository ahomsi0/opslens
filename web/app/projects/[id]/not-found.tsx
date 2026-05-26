import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="max-w-md text-center">
        <div className="text-xs font-mono tracking-widest text-[var(--color-accent)]">
          404
        </div>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
          Project not found
        </h1>
        <p className="mt-2 text-sm text-[var(--color-fg-muted)]">
          That project doesn't exist, or it may have been removed from your
          workspace.
        </p>
        <Button asChild className="mt-6">
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
