"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LogOut } from "lucide-react";
import { logout, type AuthUser } from "@/lib/auth";

export function UserMenu({ user }: { user: AuthUser | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  if (!user) return null;

  const initials = (user.name || user.email || "?")
    .split(/[\s.@_-]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  const onSignOut = async () => {
    setOpen(false);
    await logout();
    router.push("/login");
    router.refresh();
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-1 py-1 pr-3 hover:border-[var(--color-border-strong)] transition"
      >
        <Avatar user={user} initials={initials} />
        <span className="hidden sm:inline text-xs font-medium text-[var(--color-fg)] max-w-[120px] truncate">
          {user.name || user.email.split("@")[0]}
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-60 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl z-50 overflow-hidden"
        >
          <div className="px-3 py-3 border-b border-[var(--color-border)]">
            <div className="text-sm font-medium text-[var(--color-fg)] truncate">
              {user.name}
            </div>
            <div className="mt-0.5 text-xs text-[var(--color-fg-muted)] truncate">
              {user.email}
            </div>
          </div>
          <button
            role="menuitem"
            onClick={onSignOut}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-fg)] transition"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

function Avatar({
  user,
  initials,
}: {
  user: AuthUser;
  initials: string;
}) {
  if (user.avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={user.avatarUrl}
        alt={user.name}
        width={24}
        height={24}
        className="h-6 w-6 rounded-full"
      />
    );
  }
  return (
    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-accent)] text-[10px] font-bold text-black">
      {initials}
    </span>
  );
}
