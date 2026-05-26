"use client";

import { useEffect, useRef, useState } from "react";
import { connectMetrics } from "@/lib/ws";
import type { MetricFrame } from "@/lib/types";

const MAX_FRAMES = 300;

export type ConnectionStatus = "connecting" | "open" | "closed" | "error";

export function useLiveMetrics(projectId: string) {
  const [frames, setFrames] = useState<MetricFrame[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const framesRef = useRef<MetricFrame[]>([]);

  useEffect(() => {
    framesRef.current = [];
    setFrames([]);
    const stop = connectMetrics(projectId, {
      onStatus: setStatus,
      onReplay: (initial) => {
        framesRef.current = initial.slice(-MAX_FRAMES);
        setFrames(framesRef.current);
      },
      onFrame: (f) => {
        framesRef.current = [...framesRef.current, f].slice(-MAX_FRAMES);
        setFrames(framesRef.current);
      },
    });
    return () => stop();
  }, [projectId]);

  const latest = frames[frames.length - 1];

  return { frames, latest, status };
}
