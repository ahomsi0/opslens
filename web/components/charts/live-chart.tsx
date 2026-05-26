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
import type { MetricFrame } from "@/lib/types";
import { formatTime } from "@/lib/format";

interface Props {
  frames: MetricFrame[];
  dataKey: keyof MetricFrame;
  label: string;
  unit?: string;
  color?: string;
  height?: number;
  formatY?: (v: number) => string;
}

export function LiveChart({
  frames,
  dataKey,
  label,
  unit,
  color = "var(--color-accent)",
  height = 180,
  formatY,
}: Props) {
  const data = useMemo(
    () =>
      frames.slice(-120).map((f) => ({
        ts: f.ts,
        value: Number(f[dataKey]),
      })),
    [frames, dataKey],
  );

  const last = data[data.length - 1]?.value ?? 0;
  const gradId = `grad-${String(dataKey)}-${label.replace(/\s+/g, "-")}`;

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 noise">
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-fg-subtle)]">
            {label}
          </div>
          <div className="mt-0.5 font-mono text-2xl tabular-nums">
            {formatY ? formatY(last) : last.toFixed(0)}
            {unit && (
              <span className="ml-1 text-sm text-[var(--color-fg-muted)]">
                {unit}
              </span>
            )}
          </div>
        </div>
      </div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 4, right: 6, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              stroke="var(--color-border)"
              strokeDasharray="3 4"
              vertical={false}
              opacity={0.5}
            />
            <XAxis
              dataKey="ts"
              tickFormatter={formatTime}
              stroke="var(--color-fg-subtle)"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              minTickGap={40}
            />
            <YAxis
              stroke="var(--color-fg-subtle)"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              width={36}
              tickFormatter={(v) => (formatY ? formatY(v) : String(Math.round(v)))}
            />
            <Tooltip
              contentStyle={{
                background: "oklch(0.18 0.014 260 / 0.95)",
                border: "1px solid var(--color-border-strong)",
                borderRadius: 8,
                fontSize: 12,
                color: "var(--color-fg)",
                backdropFilter: "blur(8px)",
              }}
              labelFormatter={(v) => formatTime(String(v))}
              formatter={(v: number) => [
                formatY ? formatY(v) : `${v.toFixed(1)}${unit ? unit : ""}`,
                label,
              ]}
              cursor={{ stroke: "var(--color-border-strong)" }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={1.75}
              fill={`url(#${gradId})`}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
