import { cn } from "@/lib/utils";
import type { ProjectStatus } from "@/lib/types";

const styles: Record<ProjectStatus, { color: string; ring: string }> = {
  healthy: {
    color: "bg-[oklch(0.78_0.16_155)] text-[oklch(0.78_0.16_155)]",
    ring: "shadow-[0_0_0_4px_oklch(0.78_0.16_155/0.18)]",
  },
  degraded: {
    color: "bg-[oklch(0.82_0.16_80)] text-[oklch(0.82_0.16_80)]",
    ring: "shadow-[0_0_0_4px_oklch(0.82_0.16_80/0.2)]",
  },
  down: {
    color: "bg-[oklch(0.69_0.22_25)] text-[oklch(0.69_0.22_25)]",
    ring: "shadow-[0_0_0_4px_oklch(0.69_0.22_25/0.25)]",
  },
};

export function StatusDot({
  status,
  size = "md",
  pulse = true,
  className,
}: {
  status: ProjectStatus;
  size?: "sm" | "md" | "lg";
  pulse?: boolean;
  className?: string;
}) {
  const s = styles[status];
  const dim =
    size === "sm" ? "h-2 w-2" : size === "lg" ? "h-3 w-3" : "h-2.5 w-2.5";
  return (
    <span
      className={cn(
        "relative inline-flex rounded-full",
        dim,
        s.color,
        s.ring,
        pulse && "pulse-dot",
        className,
      )}
      aria-label={status}
    />
  );
}
