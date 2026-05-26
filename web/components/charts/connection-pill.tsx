"use client";

import { Wifi, WifiOff } from "lucide-react";
import type { ConnectionStatus } from "@/hooks/use-live-metrics";

export function ConnectionPill({ status }: { status: ConnectionStatus }) {
  const config =
    status === "open"
      ? {
          label: "Live",
          color: "text-[oklch(0.85_0.14_155)]",
          bg: "bg-[oklch(0.78_0.16_155/0.12)]",
          border: "border-[oklch(0.78_0.16_155/0.4)]",
          icon: <span className="h-1.5 w-1.5 rounded-full bg-[oklch(0.78_0.16_155)] pulse-dot" />,
        }
      : status === "connecting"
        ? {
            label: "Connecting…",
            color: "text-[oklch(0.88_0.14_80)]",
            bg: "bg-[oklch(0.82_0.16_80/0.12)]",
            border: "border-[oklch(0.82_0.16_80/0.4)]",
            icon: <Wifi className="h-3 w-3" />,
          }
        : {
            label: status === "error" ? "Connection error" : "Reconnecting…",
            color: "text-[oklch(0.82_0.18_25)]",
            bg: "bg-[oklch(0.69_0.22_25/0.1)]",
            border: "border-[oklch(0.69_0.22_25/0.4)]",
            icon: <WifiOff className="h-3 w-3" />,
          };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${config.color} ${config.bg} ${config.border}`}
    >
      {config.icon}
      {config.label}
    </span>
  );
}
