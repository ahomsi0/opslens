"use client";

import { useMemo } from "react";

interface Props {
  data: number[];
  width?: number;
  height?: number;
  stroke?: string;
  fill?: string;
  className?: string;
}

export function Sparkline({
  data,
  width = 120,
  height = 32,
  stroke = "var(--color-accent)",
  fill = "oklch(0.81 0.14 200 / 0.12)",
  className,
}: Props) {
  const { path, area } = useMemo(() => {
    if (!data || data.length < 2) {
      return { path: "", area: "" };
    }
    const min = Math.min(...data);
    const max = Math.max(...data);
    const span = max - min || 1;
    const stepX = width / (data.length - 1);
    const points = data.map((v, i) => {
      const x = i * stepX;
      const y = height - ((v - min) / span) * (height - 4) - 2;
      return [x, y] as const;
    });
    const d = points
      .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`)
      .join(" ");
    const a = `${d} L${width} ${height} L0 ${height} Z`;
    return { path: d, area: a };
  }, [data, width, height]);

  if (!path) {
    return (
      <svg
        width={width}
        height={height}
        className={className}
        aria-hidden
      />
    );
  }

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      aria-hidden
    >
      <path d={area} fill={fill} />
      <path
        d={path}
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
