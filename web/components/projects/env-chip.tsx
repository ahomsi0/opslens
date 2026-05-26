import { Badge } from "@/components/ui/badge";
import type { Environment } from "@/lib/types";

const map: Record<Environment, "success" | "accent" | "warning" | "outline"> = {
  production: "success",
  staging: "warning",
  preview: "accent",
  development: "outline",
};

export function EnvChip({ env }: { env: Environment }) {
  return (
    <Badge variant={map[env]} className="font-mono text-[10px] uppercase tracking-wider">
      {env}
    </Badge>
  );
}
