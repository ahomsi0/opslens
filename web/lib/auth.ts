// Auth client helpers. All calls send the session cookie via
// `credentials: "include"`. We never store the session token in JS — it's
// HTTP-only on the backend's domain.
import { apiUrl } from "./api";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  createdAt: string;
}

export interface AuthConfig {
  github: boolean;
  password: boolean;
}

export async function fetchAuthConfig(): Promise<AuthConfig> {
  try {
    const res = await fetch(apiUrl("/api/auth/config"), {
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) return { github: false, password: true };
    return (await res.json()) as AuthConfig;
  } catch {
    return { github: false, password: true };
  }
}

export async function fetchMe(
  init?: RequestInit,
): Promise<AuthUser | null> {
  try {
    const res = await fetch(apiUrl("/api/auth/me"), {
      ...init,
      credentials: "include",
      cache: "no-store",
    });
    if (res.status === 401) return null;
    if (!res.ok) return null;
    const data = await res.json();
    return data.user as AuthUser;
  } catch {
    return null;
  }
}

export interface AuthResult {
  user?: AuthUser;
  error?: string;
}

export async function signup(input: {
  email: string;
  password: string;
  name?: string;
}): Promise<AuthResult> {
  return doAuth("/api/auth/signup", input);
}

export async function login(input: {
  email: string;
  password: string;
}): Promise<AuthResult> {
  return doAuth("/api/auth/login", input);
}

export async function logout(): Promise<void> {
  await fetch(apiUrl("/api/auth/logout"), {
    method: "POST",
    credentials: "include",
  });
}

export function githubStartURL(): string {
  return apiUrl("/api/auth/github/start");
}

async function doAuth(
  path: string,
  body: unknown,
): Promise<AuthResult> {
  try {
    const res = await fetch(apiUrl(path), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      let msg = res.statusText;
      try {
        const j = await res.json();
        if (j?.error) msg = j.error;
      } catch {
        /* ignore */
      }
      return { error: msg };
    }
    const data = await res.json();
    return { user: data.user as AuthUser };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Network error" };
  }
}
