interface ResponseBank {
  keywords: string[];
  body: string;
}

const bank: ResponseBank[] = [
  {
    keywords: ["slow", "latency", "p95", "speed", "lag"],
    body: `Looking at the last 30 minutes, your p95 latency on **/v1/billing** jumped from 142ms to 412ms right after commit \`a1f3c92\` shipped to production.

Probable cause: the new \`InvoiceService.list\` method appears to issue an N+1 query against the \`invoices\` table — one SELECT per customer instead of a batched JOIN.

**Recommended fix:** replace the inner \`db.Invoices.Get\` loop with a single \`WHERE customer_id IN (...)\` query, or eager-load via a join. Expected impact: ~70% reduction in p95 for that endpoint.

I can open a Slack thread with the on-call rotation if you want to flag this.`,
  },
  {
    keywords: ["downtime", "down", "outage", "crashed", "5xx", "500"],
    body: `**Incident summary** — 14 minutes ago, *ml-inference* (Docker, syd1) started returning 5xx at 100% rate.

**What changed before:** A deployment at 17:42 UTC introduced a new dependency (\`onnxruntime==1.18\`). The container's RSS jumped from 1.1GB to 3.4GB within 90 seconds of start, exceeding the configured memory limit (2GB).

**Likely root cause:** OOM kill. The new ONNX runtime allocates a large memory pool eagerly when no \`session_options.enable_cpu_mem_arena=False\` is passed.

**Suggested next steps:**
1. Roll back to the previous Docker image while you investigate (rollback marker present in your deployment history).
2. Either raise the memory limit to 4GB or disable the eager arena.
3. Add a healthcheck probe on \`/healthz\` so this fails fast next time.`,
  },
  {
    keywords: ["deployment", "deploy", "fail", "failed", "build"],
    body: `Your most recent deployment for **billing-service** failed during the build step. Here's what I found in the build log:

\`\`\`
ERR  module not found: @opslens/billing-proto@2.4.1
     at npm resolve (ci/install:42)
\`\`\`

The version \`2.4.1\` of \`@opslens/billing-proto\` was published 9 minutes ago by **alex.chen** but appears to not yet be available from your private registry mirror — likely an indexing lag.

**Two paths forward:**
- Retry the deploy in ~2 minutes once the mirror catches up.
- Pin the dependency back to \`2.4.0\` if you don't need the new fields yet.

The previous successful deployment (\`f8d2a91\`) is still serving 100% of traffic. Nothing user-facing is broken.`,
  },
  {
    keywords: ["cold start", "cold", "render"],
    body: `Yes — I can see *worker-queue* on Render is experiencing cold starts roughly every 14 minutes, which matches Render's free-tier instance hibernation window.

**Evidence:** First-request latency spikes from ~80ms (warm) to ~3.2s (cold), then returns to baseline within 2 requests.

**Options:**
1. Upgrade to a Starter+ Render instance ($7/mo) — eliminates hibernation.
2. Add an external warmer (e.g., a 12-minute cron hitting \`/healthz\`).
3. If you can tolerate it: nothing — these requests still complete successfully.

I'd recommend option 1 if this is production traffic; option 2 if you're cost-sensitive.`,
  },
  {
    keywords: ["ssl", "cert", "certificate", "tls"],
    body: `Your SSL certificate for **api.opslens.io** expires in 6 days (Let's Encrypt, issued via Vercel).

Vercel auto-renews ~30 days before expiry, so this *should* renew tomorrow. I'll keep watching and alert you if it doesn't.

For your other monitored domains, all certs are >30 days from expiry. Nothing else action-needed.`,
  },
];

const fallback = `That's a great question — based on what I can see across your monitored services right now:

- Fleet uptime is sitting at **99.87%** over the last 7 days
- Your highest-latency endpoint is **POST /v1/billing/invoices** on **billing-service** (p95: 312ms)
- No active alerts; one warning on **billing-service** (degraded for ~22 minutes earlier today)

If you want me to dig into anything specific — a service, an incident, a deploy — just ask. Some useful prompts:
- "why is *billing-service* slow?"
- "what changed before downtime?"
- "why did the deploy fail?"
- "are we seeing cold starts anywhere?"`;

export function pickResponse(prompt: string, context?: string): string {
  const lower = prompt.toLowerCase();
  for (const entry of bank) {
    if (entry.keywords.some((k) => lower.includes(k))) {
      return entry.body;
    }
  }
  const ctxNote = context ? `\n\n_Context: ${context}_` : "";
  return fallback + ctxNote;
}

export const promptSuggestions = [
  "Why is my app slow?",
  "What changed before downtime?",
  "Why did the last deployment fail?",
  "Are we seeing cold starts?",
];
