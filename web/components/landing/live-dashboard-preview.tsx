"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useAnimationFrame } from "framer-motion";
import { Activity, CheckCircle2, Cpu, Gauge } from "lucide-react";
import { cn } from "@/lib/utils";

interface Sample {
  t: number;
  cpu: number;
  lat: number;
}

const MAX_SAMPLES = 60;

export function LiveDashboardPreview() {
  const [cpu, setCpu] = useState(34);
  const [lat, setLat] = useState(142);
  const [rps, setRps] = useState(218);
  const [uptime, setUptime] = useState(99.97);
  const [samples, setSamples] = useState<Sample[]>(() => {
    // Deterministic initial dataset — must match between server and client to
    // avoid a hydration mismatch. Randomness only kicks in inside the
    // animation frame loop below, which only runs in the browser.
    const out: Sample[] = [];
    for (let i = 0; i < MAX_SAMPLES; i++) {
      out.push({
        t: i,
        cpu: 30 + Math.sin(i * 0.2) * 10 + Math.sin(i * 0.7) * 3,
        lat: 130 + Math.cos(i * 0.18) * 25 + Math.cos(i * 0.45) * 8,
      });
    }
    return out;
  });
  const lastTickRef = useRef(0);
  const phaseRef = useRef(0);

  useAnimationFrame((t) => {
    if (t - lastTickRef.current < 800) return;
    lastTickRef.current = t;
    phaseRef.current += 0.18;
    const phase = phaseRef.current;
    const newCpu = Math.max(
      8,
      Math.min(82, 36 + Math.sin(phase) * 10 + (Math.random() - 0.5) * 8),
    );
    const newLat = Math.max(
      60,
      Math.min(380, 140 + Math.sin(phase * 0.7) * 30 + (Math.random() - 0.5) * 25),
    );
    const newRps = Math.max(
      80,
      Math.min(420, 220 + Math.sin(phase * 0.5) * 50 + (Math.random() - 0.5) * 30),
    );
    setCpu(newCpu);
    setLat(newLat);
    setRps(newRps);
    setUptime((u) =>
      Math.min(99.99, Math.max(99.9, u + (Math.random() - 0.45) * 0.01)),
    );
    setSamples((s) => {
      const next = s.slice(1).concat({
        t: s[s.length - 1].t + 1,
        cpu: newCpu,
        lat: newLat,
      });
      return next;
    });
  });

  return (
    <div className="relative">
      <div className="relative rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl noise overflow-hidden">
        <FakeChrome />
        <div className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="h-2 w-2 rounded-full bg-[oklch(0.78_0.16_155)] pulse-dot shadow-[0_0_0_4px_oklch(0.78_0.16_155/0.18)]" />
              <div>
                <div className="text-sm font-medium tracking-tight">
                  api-gateway
                </div>
                <div className="text-[11px] font-mono text-[var(--color-fg-subtle)]">
                  vercel · iad1 · main@a1f3c92
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-[var(--color-fg-subtle)]">
                Uptime · 30d
              </div>
              <div className="font-mono text-sm tabular-nums">
                {uptime.toFixed(3)}%
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <MetricTile
              icon={<Cpu className="h-3.5 w-3.5" />}
              label="CPU"
              value={`${Math.round(cpu)}%`}
              accent="cyan"
            />
            <MetricTile
              icon={<Gauge className="h-3.5 w-3.5" />}
              label="p95"
              value={`${Math.round(lat)}ms`}
              accent="violet"
            />
            <MetricTile
              icon={<Activity className="h-3.5 w-3.5" />}
              label="RPS"
              value={Math.round(rps).toLocaleString()}
              accent="emerald"
            />
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between text-[11px] text-[var(--color-fg-subtle)] mb-1.5">
              <span className="font-mono uppercase tracking-wider">
                Latency · last 60s
              </span>
              <span className="font-mono tabular-nums">
                {Math.round(lat)}ms
              </span>
            </div>
            <MiniChart samples={samples} />
          </div>

          <div className="mt-4 rounded-lg border border-[oklch(0.74_0.18_295/0.35)] bg-[oklch(0.74_0.18_295/0.06)] p-3">
            <div className="flex items-start gap-2">
              <div className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-md bg-[oklch(0.74_0.18_295/0.2)] text-[oklch(0.85_0.14_295)]">
                <Sparkle />
              </div>
              <div className="text-[12px] leading-relaxed text-[var(--color-fg)]">
                <span className="text-[oklch(0.85_0.14_295)] font-medium">
                  Opslens AI:
                </span>{" "}
                Detected a 38% latency spike on{" "}
                <span className="font-mono text-[var(--color-fg-muted)]">
                  /v1/billing
                </span>{" "}
                after deploy{" "}
                <span className="font-mono text-[var(--color-fg-muted)]">
                  a1f3c92
                </span>
                . Likely cause: new N+1 query in{" "}
                <span className="font-mono text-[var(--color-fg-muted)]">
                  InvoiceService.list
                </span>
                .
              </div>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between text-[11px] text-[var(--color-fg-subtle)]">
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-3 w-3 text-[oklch(0.78_0.16_155)]" />
              No incidents
            </span>
            <span className="font-mono">12 services · 4 regions</span>
          </div>
        </div>
      </div>

      <FloatingPills />
    </div>
  );
}

function MetricTile({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: "cyan" | "violet" | "emerald";
}) {
  const colors = {
    cyan: "text-[oklch(0.88_0.12_200)]",
    violet: "text-[oklch(0.85_0.14_295)]",
    emerald: "text-[oklch(0.85_0.14_155)]",
  };
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-2.5">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[var(--color-fg-subtle)]">
        <span className={colors[accent]}>{icon}</span>
        {label}
      </div>
      <div className="mt-1 font-mono text-base tabular-nums">{value}</div>
    </div>
  );
}

function MiniChart({ samples }: { samples: Sample[] }) {
  const w = 480;
  const h = 110;
  const min = Math.min(...samples.map((s) => s.lat));
  const max = Math.max(...samples.map((s) => s.lat));
  const span = max - min || 1;
  const step = w / (samples.length - 1);
  const pts = samples.map(
    (s, i) =>
      [i * step, h - ((s.lat - min) / span) * (h - 12) - 6] as const,
  );
  const path = pts
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(" ");
  const area = `${path} L${w} ${h} L0 ${h} Z`;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="w-full h-[110px]"
      preserveAspectRatio="none"
      aria-hidden
    >
      <path d={area} fill="oklch(0.81 0.14 200)" fillOpacity="0.12" />
      <path
        d={path}
        fill="none"
        stroke="oklch(0.81 0.14 200)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={pts[pts.length - 1][0]}
        cy={pts[pts.length - 1][1]}
        r="3"
        fill="oklch(0.81 0.14 200)"
      />
      <circle
        cx={pts[pts.length - 1][0]}
        cy={pts[pts.length - 1][1]}
        r="6"
        fill="oklch(0.81 0.14 200 / 0.25)"
      />
    </svg>
  );
}

function Sparkle() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3">
      <path d="M12 2l1.6 5.4L19 9l-5.4 1.6L12 16l-1.6-5.4L5 9l5.4-1.6L12 2z" />
    </svg>
  );
}

function FakeChrome() {
  return (
    <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-4 py-2.5">
      <div className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-[oklch(0.69_0.22_25/0.7)]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[oklch(0.82_0.16_80/0.7)]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[oklch(0.78_0.16_155/0.7)]" />
      </div>
      <div className="text-[11px] font-mono text-[var(--color-fg-subtle)]">
        opslens.io/api-gateway
      </div>
      <div className="w-12" />
    </div>
  );
}

// Glow removed — was a radial gradient. The card now relies on its border
// and shadow alone for separation from the background.

function FloatingPills() {
  return (
    <>
      <motion.div
        initial={{ opacity: 0, x: 20, y: -20 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        transition={{ delay: 0.6, duration: 0.6 }}
        className={cn(
          "absolute -right-4 -top-4 hidden sm:block",
          "rounded-full border border-[var(--color-border)] glass px-3 py-1.5 text-[11px] font-mono shadow-lg",
        )}
      >
        <span className="text-[oklch(0.78_0.16_155)]">●</span> deploy succeeded
      </motion.div>
      <motion.div
        initial={{ opacity: 0, x: -20, y: 20 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        transition={{ delay: 0.8, duration: 0.6 }}
        className={cn(
          "absolute -left-4 -bottom-4 hidden sm:block",
          "rounded-full border border-[var(--color-border)] glass px-3 py-1.5 text-[11px] font-mono shadow-lg",
        )}
      >
        <span className="text-[oklch(0.85_0.14_295)]">✨</span> AI insight ready
      </motion.div>
    </>
  );
}
