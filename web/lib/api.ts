import type {
  Connection,
  Deployment,
  LogEntry,
  Project,
  ProjectSummary,
} from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

async function get<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { Accept: "application/json", ...(init?.headers || {}) },
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
  const res = await fetch(`${API_URL}/api/connections`, {
    method: "POST",
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
  const res = await fetch(`${API_URL}/api/connections/${id}`, {
    method: "DELETE",
    cache: "no-store",
  });
  if (!res.ok && res.status !== 204) {
    throw new Error(`Failed to delete connection: ${res.status}`);
  }
}

export function apiUrl(path: string) {
  return `${API_URL}${path}`;
}

export type { Project };
