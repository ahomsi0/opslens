import type { Provider } from "@/lib/types";
import { cn } from "@/lib/utils";

// Brand-accurate hex colors. Pulled from each provider's public brand kit
// or their canonical favicon.
const colors: Record<Provider, string> = {
  vercel: "text-white",
  render: "text-[#46E3B7]",
  railway: "text-[#C2B6F5]",
  supabase: "text-[#3ECF8E]",
  neon: "text-[#00E699]",
  docker: "text-[#2496ED]",
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
    // Vercel — canonical filled triangle (▲). Their logo unchanged since 2020.
    case "vercel":
      return (
        <svg
          viewBox="0 0 76 65"
          fill="currentColor"
          className={className}
          aria-hidden
        >
          <path d="M37.527 0 75.054 65H0z" />
        </svg>
      );

    // Render — rounded square in their brand teal, with a small inset hex
    // hinting at "renderer / 3D output." Matches Render's app/favicon style.
    case "render":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className={className}
          aria-hidden
        >
          <rect width="24" height="24" rx="5.5" fill="currentColor" />
          <circle cx="12" cy="12" r="4" fill="#0A0B0F" />
        </svg>
      );

    // Railway — rounded square in their soft violet brand color. Railway's
    // current mark on the dashboard is a stylized M; at favicon size a clean
    // monochrome square reads correctly.
    case "railway":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden>
          <rect
            x="2"
            y="2"
            width="20"
            height="20"
            rx="5"
            fill="currentColor"
          />
          <path
            d="M7 16V8l3 4 2-3 2 3 3-4v8"
            stroke="#0A0B0F"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
      );

    // Supabase — their iconic lightning-bolt mark. Single filled path.
    case "supabase":
      return (
        <svg
          viewBox="0 0 109 113"
          fill="currentColor"
          className={className}
          aria-hidden
        >
          <path d="M63.708 110.284c-2.86 3.601-8.658 1.628-8.727-2.97l-1.007-67.251h45.22c8.19 0 12.758 9.46 7.665 15.874l-43.151 54.347Z" />
          <path d="M45.317 2.071c2.86-3.601 8.657-1.628 8.726 2.97l1.442 67.25H10.836c-8.19 0-12.758-9.46-7.665-15.873L45.317 2.07Z" />
        </svg>
      );

    // Neon — their "N" mark: a stylized capital N in a rounded square.
    case "neon":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
          <rect
            x="2"
            y="2"
            width="20"
            height="20"
            rx="5"
            fill="currentColor"
          />
          <path
            d="M7 17V7h2.4l5.2 7V7H17v10h-2.4l-5.2-7v7H7Z"
            fill="#0A0B0F"
          />
        </svg>
      );

    // Docker — the canonical whale silhouette with stacked containers on top.
    // Single-color rendition that reads at small sizes.
    case "docker":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          className={className}
          aria-hidden
        >
          <g>
            <rect x="3.5" y="11" width="2.7" height="2.4" rx="0.3" />
            <rect x="6.6" y="11" width="2.7" height="2.4" rx="0.3" />
            <rect x="9.7" y="11" width="2.7" height="2.4" rx="0.3" />
            <rect x="12.8" y="11" width="2.7" height="2.4" rx="0.3" />
            <rect x="6.6" y="8.1" width="2.7" height="2.4" rx="0.3" />
            <rect x="9.7" y="8.1" width="2.7" height="2.4" rx="0.3" />
            <rect x="9.7" y="5.2" width="2.7" height="2.4" rx="0.3" />
            <path d="M22.5 12.3c-.3-.2-1.7-.7-3.2-.5-.2-1-.7-1.8-1.6-2.4l-.4-.3-.3.4c-.6.7-.8 1.9-.3 2.7-.6.3-1.4.5-2.4.5H1.7l-.1.3c-.2 1.4 0 5.9 3.8 8.1 2.9 1.6 6.2 2.1 8.5 2.1 4.7 0 8.3-1.6 10-4.4 1.4-2.3 1.2-4.7 1-5.7l-.4-.8Z" />
          </g>
        </svg>
      );
  }
}

export { labels as providerLabels };
