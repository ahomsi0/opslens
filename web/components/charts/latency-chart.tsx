"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { LatencyPoint } from "@/lib/api";
import { formatMs, formatTime } from "@/lib/format";

// Real latency chart from uptime probes. Shows p50 + p95 over time.
// Used on the project detail page in place of the synthetic WS charts.
export function LatencyChart({
  series,
  height = 240,
}: {
  series: LatencyPoint[];
  height?: number;
}) {
  const data = useMemo(
    () =>
      series.map((p) => ({
        ts: p.ts,
        p50: p.p50,
        p95: p.p95,
      })),
    [series],
  );

  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)]"
        style={{ height }}
      >
        <div className="text-center text-sm text-[var(--color-fg-muted)]">
          No probes recorded yet — check back in a minute.
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 noise">
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-fg-subtle)]">
            Response latency
          </div>
          <div className="mt-0.5 text-sm text-[var(--color-fg-muted)]">
            p50 / p95 measured from {data.length} uptime probes
          </div>
        </div>
      </div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 6, left: 0, bottom: 0 }}>
            <CartesianGrid
              stroke="var(--color-border)"
              strokeDasharray="3 4"
              vertical={false}
              opacity={0.5}
            />
            <XAxis
              dataKey="ts"
              tickFormatter={(v) => formatTime(String(v))}
              stroke="var(--color-fg-subtle)"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              minTickGap={48}
            />
            <YAxis
              stroke="var(--color-fg-subtle)"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              width={42}
              tickFormatter={(v) => formatMs(Number(v))}
            />
            <Tooltip
              contentStyle={{
                background: "oklch(0.18 0 0 / 0.96)",
                border: "1px solid var(--color-border-strong)",
                borderRadius: 8,
                fontSize: 12,
                color: "var(--color-fg)",
              }}
              labelFormatter={(v) => formatTime(String(v))}
              formatter={(v: number, key) => [formatMs(v), key]}
              cursor={{ stroke: "var(--color-border-strong)" }}
            />
            <Area
              type="monotone"
              dataKey="p95"
              stroke="var(--color-accent)"
              strokeWidth={1.75}
              fill="var(--color-accent)"
              fillOpacity={0.1}
              isAnimationActive={false}
              name="p95"
            />
            <Area
              type="monotone"
              dataKey="p50"
              stroke="var(--color-fg-muted)"
              strokeWidth={1.25}
              fill="var(--color-fg-muted)"
              fillOpacity={0.05}
              isAnimationActive={false}
              name="p50"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
