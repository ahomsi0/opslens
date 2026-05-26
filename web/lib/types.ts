export type ProjectStatus = "healthy" | "degraded" | "down";
export type Provider =
  | "vercel"
  | "render"
  | "railway"
  | "supabase"
  | "neon"
  | "docker";
export type Environment = "production" | "staging" | "preview" | "development";
export type DeploymentStatus =
  | "success"
  | "failed"
  | "rolled-back"
  | "building"
  | "canceled";
export type LogLevel = "info" | "warn" | "error" | "debug";

export interface Project {
  id: string;
  name: string;
  slug: string;
  provider: Provider;
  environment: Environment;
  region: string;
  repoUrl: string;
  domain: string;
  status: ProjectStatus;
  createdAt: string;
  source?: string; // 'demo' | 'vercel' | ...
  connectionId?: string | null;
  externalId?: string | null;
  liveMetrics?: boolean;
}

export interface Connection {
  id: string;
  workspaceId: string;
  provider: Provider;
  name: string;
  accountLabel?: string | null;
  createdAt: string;
  lastSyncedAt?: string | null;
  lastError?: string | null;
}

export interface Deployment {
  id: string;
  projectId: string;
  status: DeploymentStatus;
  commitSha: string;
  commitMsg: string;
  author: string;
  branch: string;
  durationMs: number;
  createdAt: string;
}

export interface ProjectSummary extends Project {
  uptimePct: number;
  latencyP95Ms: number;
  lastDeployment?: Deployment | null;
  latencySpark: number[];
  activeIncidents: number;
}

export interface LogEntry {
  id: number;
  projectId: string;
  level: LogLevel;
  source: string;
  message: string;
  createdAt: string;
}

export interface MetricFrame {
  type: "metric";
  projectId: string;
  ts: string;
  cpu: number;
  memory: number;
  netIn: number;
  netOut: number;
  latencyMs: number;
  rps: number;
  status: ProjectStatus;
}

export interface ReplayMessage {
  type: "replay";
  frames: MetricFrame[];
}

export type WsMessage = MetricFrame | ReplayMessage;
