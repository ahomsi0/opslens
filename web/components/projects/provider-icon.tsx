import type { Provider } from "@/lib/types";
import { cn } from "@/lib/utils";

const colors: Record<Provider, string> = {
  vercel: "text-white",
  render: "text-[oklch(0.78_0.16_155)]",
  railway: "text-[oklch(0.74_0.18_295)]",
  supabase: "text-[oklch(0.78_0.16_155)]",
  neon: "text-[oklch(0.81_0.14_200)]",
  docker: "text-[oklch(0.7_0.15_240)]",
};

const labels: Record<Provider, string> = {
  vercel: "Vercel",
  render: "Render",
  railway: "Railway",
  supabase: "Supabase",
  neon: "Neon",
  docker: "Docker",
};

export function ProviderIcon({
  provider,
  className,
  showLabel = false,
}: {
  provider: Provider;
  className?: string;
  showLabel?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <Mark provider={provider} className={cn("h-3.5 w-3.5", colors[provider])} />
      {showLabel && (
        <span className="text-xs text-[var(--color-fg-muted)]">
          {labels[provider]}
        </span>
      )}
    </span>
  );
}

function Mark({
  provider,
  className,
}: {
  provider: Provider;
  className?: string;
}) {
  switch (provider) {
    case "vercel":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          className={className}
          aria-hidden
        >
          <path d="M12 2 22 20H2L12 2Z" />
        </svg>
      );
    case "render":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden>
          <circle cx="12" cy="12" r="9" fill="currentColor" opacity="0.9" />
        </svg>
      );
    case "railway":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden>
          <rect
            x="3"
            y="3"
            width="18"
            height="18"
            rx="4"
            fill="currentColor"
          />
        </svg>
      );
    case "supabase":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          className={className}
          aria-hidden
        >
          <path d="M13 2 4 14h7v8l9-12h-7V2Z" />
        </svg>
      );
    case "neon":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          className={className}
          aria-hidden
        >
          <rect x="4" y="4" width="16" height="16" rx="3" />
          <path d="M4 14h16" />
        </svg>
      );
    case "docker":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden>
          <g fill="currentColor">
            <rect x="4" y="11" width="3" height="3" rx="0.5" />
            <rect x="8" y="11" width="3" height="3" rx="0.5" />
            <rect x="12" y="11" width="3" height="3" rx="0.5" />
            <rect x="8" y="7" width="3" height="3" rx="0.5" />
            <path
              d="M4 15c0 2 2 4 7 4s8-2 9-5h-1c-1 0-2 0-3 1"
              stroke="currentColor"
              strokeWidth="1.5"
              fill="none"
            />
          </g>
        </svg>
      );
  }
}

export { labels as providerLabels };
