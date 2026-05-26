"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, Github, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OpslensLogo } from "@/components/landing/opslens-logo";
import {
  fetchAuthConfig,
  githubStartURL,
  login,
  signup,
  type AuthConfig,
} from "@/lib/auth";

type Mode = "login" | "signup";

const errorLabels: Record<string, string> = {
  missing_code: "GitHub didn't return an authorization code.",
  bad_state: "GitHub callback was rejected (state mismatch). Try again.",
  exchange_failed: "Couldn't exchange the GitHub code for a token.",
  no_email: "GitHub didn't return a verified email. Add one in your GitHub email settings, then retry.",
  create_failed: "Couldn't create your account.",
};

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/dashboard";
  const oauthError = params.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(
    oauthError ? errorLabels[oauthError] ?? `OAuth error: ${oauthError}` : null,
  );
  const [busy, setBusy] = useState(false);
  const [config, setConfig] = useState<AuthConfig>({
    github: false,
    password: true,
  });

  useEffect(() => {
    fetchAuthConfig().then(setConfig);
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const result =
      mode === "signup"
        ? await signup({ email, password, name })
        : await login({ email, password });
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.push(next);
    router.refresh();
  };

  const heading = mode === "signup" ? "Create your account" : "Welcome back";
  const sub =
    mode === "signup"
      ? "Start monitoring your infrastructure in under a minute."
      : "Sign in to your Opslens workspace.";
  const submitLabel = mode === "signup" ? "Create account" : "Sign in";
  const altText =
    mode === "signup" ? (
      <>
        Already have an account?{" "}
        <Link
          href="/login"
          className="text-[var(--color-accent)] hover:underline"
        >
          Sign in
        </Link>
      </>
    ) : (
      <>
        New here?{" "}
        <Link
          href="/signup"
          className="text-[var(--color-accent)] hover:underline"
        >
          Create an account
        </Link>
      </>
    );

  return (
    <div className="w-full max-w-sm">
      <Link href="/" className="inline-flex items-center gap-2 mb-8">
        <OpslensLogo className="h-7 w-7 text-[var(--color-accent)]" />
        <span className="font-semibold tracking-tight text-lg">Opslens</span>
      </Link>

      <h1 className="text-2xl font-semibold tracking-tight">{heading}</h1>
      <p className="mt-1 text-sm text-[var(--color-fg-muted)]">{sub}</p>

      {error && (
        <div className="mt-5 rounded-md border border-[oklch(0.69_0.22_25/0.4)] bg-[oklch(0.69_0.22_25/0.08)] p-2.5 text-xs text-[oklch(0.82_0.18_25)]">
          {error}
        </div>
      )}

      {config.github && (
        <>
          <Button
            asChild
            variant="outline"
            className="mt-6 w-full gap-2"
            disabled={busy}
          >
            <a href={githubStartURL()}>
              <Github className="h-4 w-4" />
              Continue with GitHub
            </a>
          </Button>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-[var(--color-border)]" />
            <span className="text-[10px] uppercase tracking-wider text-[var(--color-fg-subtle)]">
              or with email
            </span>
            <div className="h-px flex-1 bg-[var(--color-border)]" />
          </div>
        </>
      )}

      <form onSubmit={submit} className={config.github ? "space-y-4" : "mt-6 space-y-4"}>
        {mode === "signup" && (
          <div>
            <label
              htmlFor="name"
              className="text-xs font-medium text-[var(--color-fg-muted)]"
            >
              Display name
            </label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Alex"
              className="mt-1"
              disabled={busy}
              autoComplete="name"
            />
          </div>
        )}

        <div>
          <label
            htmlFor="email"
            className="text-xs font-medium text-[var(--color-fg-muted)]"
          >
            Email
          </label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="mt-1"
            required
            disabled={busy}
            autoComplete="email"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="text-xs font-medium text-[var(--color-fg-muted)]"
          >
            Password
          </label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={
              mode === "signup" ? "At least 8 characters" : "Your password"
            }
            className="mt-1"
            required
            minLength={mode === "signup" ? 8 : undefined}
            disabled={busy}
            autoComplete={
              mode === "signup" ? "new-password" : "current-password"
            }
          />
        </div>

        <Button type="submit" className="w-full gap-2" disabled={busy}>
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ArrowRight className="h-4 w-4" />
          )}
          {busy ? "…" : submitLabel}
        </Button>
      </form>

      <p className="mt-6 text-xs text-[var(--color-fg-muted)]">{altText}</p>
    </div>
  );
}
