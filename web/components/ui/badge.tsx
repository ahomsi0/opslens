import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        default:
          "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-fg-muted)]",
        success:
          "border-[oklch(0.78_0.16_155/0.4)] bg-[oklch(0.78_0.16_155/0.12)] text-[oklch(0.85_0.14_155)]",
        warning:
          "border-[oklch(0.82_0.16_80/0.45)] bg-[oklch(0.82_0.16_80/0.12)] text-[oklch(0.88_0.14_80)]",
        danger:
          "border-[oklch(0.69_0.22_25/0.5)] bg-[oklch(0.69_0.22_25/0.15)] text-[oklch(0.82_0.18_25)]",
        accent:
          "border-[oklch(0.62_0.13_200/0.45)] bg-[oklch(0.62_0.13_200/0.12)] text-[oklch(0.78_0.13_200)]",
        violet:
          "border-[oklch(0.74_0.18_295/0.45)] bg-[oklch(0.74_0.18_295/0.12)] text-[oklch(0.85_0.14_295)]",
        outline:
          "border-[var(--color-border-strong)] bg-transparent text-[var(--color-fg-muted)]",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, className }))} {...props} />;
}
