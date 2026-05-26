import { cn } from "@/lib/utils";

// Skeleton placeholder. Uses the existing `.shimmer` keyframe (opacity
// pulse — no gradient) so it matches the rest of the visual language.
export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "shimmer rounded-md bg-[var(--color-surface-2)]",
        className,
      )}
      {...props}
    />
  );
}
