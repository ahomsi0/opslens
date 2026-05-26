"use client";

import type { MetricFrame, WsMessage } from "./types";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8080";

export interface MetricsStreamHandlers {
  onFrame: (frame: MetricFrame) => void;
  onReplay?: (frames: MetricFrame[]) => void;
  onStatus?: (s: "connecting" | "open" | "closed" | "error") => void;
}

export function connectMetrics(
  projectId: string,
  handlers: MetricsStreamHandlers,
): () => void {
  let ws: WebSocket | null = null;
  let stopped = false;
  let attempt = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const open = () => {
    if (stopped) return;
    handlers.onStatus?.("connecting");
    const url = `${WS_URL}/ws/projects/${projectId}/metrics`;
    ws = new WebSocket(url);
    ws.onopen = () => {
      attempt = 0;
      handlers.onStatus?.("open");
    };
    ws.onmessage = (ev) => {
      try {
        const data: WsMessage = JSON.parse(ev.data);
        if (data.type === "replay") {
          handlers.onReplay?.(data.frames);
        } else if (data.type === "metric") {
          handlers.onFrame(data);
        }
      } catch {
        // ignore malformed
      }
    };
    ws.onclose = () => {
      handlers.onStatus?.("closed");
      if (stopped) return;
      const delay = Math.min(8000, 1000 * 2 ** attempt);
      attempt++;
      timer = setTimeout(open, delay);
    };
    ws.onerror = () => {
      handlers.onStatus?.("error");
      try {
        ws?.close();
      } catch {
        // noop
      }
    };
  };

  open();

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    try {
      ws?.close();
    } catch {
      // noop
    }
  };
}
