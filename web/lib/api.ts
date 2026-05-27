import type {
  Connection,
  Deployment,
  LogEntry,
  Project,
  ProjectSummary,
} from "./types";

// Client uses relative `/api/*` URLs — Vercel rewrites proxy them to the
// backend, which keeps the session cookie same-origin (the only way
// middleware can read it). Server-side fetches can't be relative, so we
// use BACKEND_URL (server-only) for those and manually forward the cookie.
const CLIENT_BASE = "";

function normalize(u: string): string {
  return u
    .trim() // strip whitespace (e.g. a space someone pasted by accident)
    .replace(/\/+$/, "") // strip trailing slashes
    .replace(/\/api$/, ""); // strip trailing /api so we can append /api/... cleanly
}

const SERVER_BASE = normalize(
  process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:8080",
);

function urlFor(path: string): string {
  if (typeof window === "undefined") return `${SERVER_BASE}${path}`;
  return `${CLIENT_BASE}${path}`;
}

async function forwardedCookie(): Promise<string | undefined> {
  if (typeof window !== "undefined") return undefined;
  try {
    const mod = await import("next/headers");
    const cookieStore = await mod.cookies();
    const v = cookieStore.get("opslens_session")?.value;
    return v ? `opslens_session=${v}` : undefined;
  } catch {
    return undefined;
  }
}

async function get<T>(path: string, init?: RequestInit): Promise<T> {
  const cookie = await forwardedCookie();
  const res = await fetch(urlFor(path), {
    ...init,
    headers: {
      Accept: "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
      ...(init?.headers || {}),
    },
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${path} → ${res.status}: ${text || res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export async function fetchProjects(): Promise<ProjectSummary[]> {
  const data = await get<{ projects: ProjectSummary[] }>(`/api/projects`);
  return data.projects ?? [];
}

export async function fetchProject(id: string): Promise<{
  project: ProjectSummary;
  deployments: Deployment[];
} | null> {
  try {
    return await get<{ project: ProjectSummary; deployments: Deployment[] }>(
      `/api/projects/${id}`,
    );
  } catch {
    return null;
  }
}

export async function fetchDeployments(id: string): Promise<Deployment[]> {
  const data = await get<{ deployments: Deployment[] }>(
    `/api/projects/${id}/deployments?limit=30`,
  );
  return data.deployments ?? [];
}

export interface LogQuery {
  levels?: string[];
  q?: string;
  cursor?: number;
  limit?: number;
}

export async function fetchLogs(
  id: string,
  query: LogQuery = {},
): Promise<{ logs: LogEntry[]; nextCursor: number | null }> {
  const params = new URLSearchParams();
  if (query.levels?.length) params.set("level", query.levels.join(","));
  if (query.q) params.set("q", query.q);
  if (query.cursor) params.set("cursor", String(query.cursor));
  if (query.limit) params.set("limit", String(query.limit));
  const qs = params.toString();
  const data = await get<{ logs: LogEntry[]; nextCursor: number | null }>(
    `/api/projects/${id}/logs${qs ? `?${qs}` : ""}`,
  );
  return data;
}

// --- Connections ---

export async function fetchConnections(): Promise<Connection[]> {
  const data = await get<{ connections: Connection[] }>(`/api/connections`);
  return data.connections ?? [];
}

export async function createConnection(input: {
  provider: string;
  name: string;
  token: string;
}): Promise<Connection> {
  const res = await fetch(urlFor("/api/connections"), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    cache: "no-store",
  });
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const j = await res.json();
      if (j?.error) msg = j.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return res.json();
}

export async function deleteConnection(id: string): Promise<void> {
  const res = await fetch(urlFor(`/api/connections/${id}`), {
    method: "DELETE",
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok && res.status !== 204) {
    throw new Error(`Failed to delete connection: ${res.status}`);
  }
}

export function apiUrl(path: string) {
  return urlFor(path);
}

// --- AI ---

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AILimits {
  perUserPerMinute: number;
  perUserPerDay: number;
  globalPerDay: number;
  maxPromptChars: number;
}

export interface AIConfig {
  enabled: boolean;
  limits?: AILimits;
}

export interface AIUsage {
  limits: AILimits;
  usedTodayUser: number;
  usedThisMinute: number;
  usedTodayGlobal: number;
  remainingToday: number;
}

export async function fetchAIConfig(): Promise<AIConfig> {
  try {
    return await get<AIConfig>(`/api/ai/config`);
  } catch {
    return { enabled: false };
  }
}

export async function fetchAIUsage(): Promise<AIUsage | null> {
  try {
    return await get<AIUsage>(`/api/ai/quota`);
  } catch {
    return null;
  }
}

// --- Project metrics (real, from uptime probes) ---

export interface LatencyPoint {
  ts: string;
  p50: number;
  p95: number;
  count: number;
  failures: number;
}

export interface LatencySummary {
  p50: number;
  p95: number;
  p99: number;
}

export interface UptimeStats {
  percent: number;
  total: number;
  failed: number;
  windowH: number;
  hasData: boolean;
}

export interface ProjectMetrics {
  latency: {
    series: LatencyPoint[];
    summary: LatencySummary | null;
  };
  uptime: UptimeStats | null;
}

export async function fetchProjectMetrics(
  projectId: string,
  window: "24h" | "7d" | "30d" = "24h",
): Promise<ProjectMetrics | null> {
  try {
    return await get<ProjectMetrics>(
      `/api/projects/${projectId}/metrics?window=${window}`,
    );
  } catch {
    return null;
  }
}

/**
 * Streams an AI chat completion from the backend. Yields incremental text
 * deltas. Throws if the backend isn't configured (503) so the caller can
 * fall back to canned responses.
 */
export async function* streamAIChat(
  messages: ChatMessage[],
  opts?: { projectId?: string; signal?: AbortSignal },
): AsyncGenerator<string, void, void> {
  const res = await fetch(urlFor("/api/ai/chat"), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, projectId: opts?.projectId }),
    signal: opts?.signal,
    cache: "no-store",
  });
  if (!res.ok) {
    let detail = `${res.status}`;
    try {
      const j = await res.json();
      if (j?.error) detail = j.error;
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  if (!res.body) throw new Error("no response body");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE messages are delimited by blank lines (\n\n).
    let idx: number;
    while ((idx = buffer.indexOf("\n\n")) !== -1) {
      const raw = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const dataLine = raw
        .split("\n")
        .find((l) => l.startsWith("data: "));
      if (!dataLine) continue;
      const payload = dataLine.slice(6);
      try {
        const obj = JSON.parse(payload);
        if (obj.delta) yield obj.delta as string;
        if (obj.error) throw new Error(obj.error);
        if (obj.done) return;
      } catch (err) {
        if (err instanceof Error && err.message) throw err;
        // ignore parse errors on malformed chunks
      }
    }
  }
}

export type { Project };
