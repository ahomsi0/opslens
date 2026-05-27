import { Skeleton } from "@/components/ui/skeleton";

export default function IncidentsLoading() {
  return (
    <div className="flex min-h-screen">
      <aside className="hidden lg:flex h-screen sticky top-0 w-60 shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-bg-elevated)]/60">
        <div className="h-14 border-b border-[var(--color-border)] px-5 flex items-center">
          <Skeleton className="h-5 w-24" />
        </div>
        <div className="p-3 space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-[var(--color-border)] glass px-5">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-8 w-44" />
        </header>

        <main className="flex-1">
          <div className="mx-auto max-w-4xl px-6 py-8 space-y-6">
            <Skeleton className="h-8 w-40" />
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
