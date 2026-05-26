# Deploying Opslens

End-to-end guide for getting Opslens running on the internet using:

- **GitHub** — source of truth
- **Neon** — managed Postgres (free tier)
- **Render** — Go backend (free tier)
- **Vercel** — Next.js frontend (free tier)

Total cost: **$0/month** to start.
Expected setup time: **~25 minutes** if accounts are ready, mostly waiting for builds.

## Prerequisites

Accounts needed (sign up with the same email if you want — makes life easier):

1. **GitHub** — should already exist
2. **Neon** — <https://neon.tech>, sign in with GitHub
3. **Render** — <https://render.com>, sign in with GitHub
4. **Vercel** — <https://vercel.com>, sign in with GitHub

Everything is free-tier compatible.

---

## Step 1 — Push to GitHub

You're already inside the repo. From a terminal:

```bash
gh repo create ahomsi0/opslens --public --source=. --remote=origin --push
```

That creates the GitHub repo *and* pushes in one command. Visit
<https://github.com/ahomsi0/opslens> to confirm.

---

## Step 2 — Provision the database (Neon)

1. Go to <https://console.neon.tech>
2. Click **New Project**:
   - Name: `opslens`
   - Region: pick the one closest to where you'll deploy Render (Oregon =
     `us-west-2` is the default Render region)
   - Postgres version: latest
3. After it spins up, you'll land on the project's dashboard.
4. In the sidebar, click **Connection Details**.
5. Copy the **pooled** connection string. It looks like:

   ```
   postgres://opslens_owner:abcd1234@ep-xxx-pooler.us-west-2.aws.neon.tech/neondb?sslmode=require
   ```

   ⚠️ Use the **pooled** one (the host contains `-pooler`). It handles many
   short-lived connections better, which matches our use pattern.
6. Save this string — you'll paste it into Render in the next step.

> The migrations and seed data run automatically the first time the backend
> connects, so there's nothing to do in Neon beyond getting the URL.

---

## Step 3 — Deploy the backend (Render)

1. Go to <https://dashboard.render.com>
2. Click **New +** → **Blueprint**
3. Connect your GitHub account if not already connected
4. Select the `opslens` repo
5. Render detects `render.yaml` and pre-fills the service config. Click
   **Apply**.
6. The service will fail to start the first time — that's expected, env vars
   aren't set yet. Click into the `opslens-api` service.
7. Open the **Environment** tab and add these three variables:

   | Key | Value |
   |---|---|
   | `DATABASE_URL` | the Neon pooled connection string from Step 2 |
   | `ENCRYPTION_KEY` | run `openssl rand -base64 32` locally and paste the output |
   | `CORS_ORIGIN` | `https://opslens.vercel.app` (we'll fix this in Step 5 if needed) |

8. Click **Save Changes**. Render redeploys automatically.
9. Wait ~3 minutes for the build. Watch **Logs** until you see:

   ```
   loaded N projects with live metrics
   listening on :8080
   ```

10. Note the URL Render assigned at the top of the page. It looks like:

    ```
    https://opslens-api.onrender.com
    ```

11. Test it:

    ```bash
    curl https://opslens-api.onrender.com/api/health
    ```

    Should return `{"ok":true,...}`.

> **Free tier note**: Render's free plan spins the service down after 15 min
> of inactivity. The first request after that takes 30–60s. The frontend will
> show "Couldn't reach the API" during that window — refresh after a minute.
> Upgrade to the **Starter** plan ($7/mo) to eliminate cold starts.

---

## Step 4 — Deploy the frontend (Vercel)

1. Go to <https://vercel.com/new>
2. Click **Import Git Repository**, select `opslens`
3. **Configure Project**:
   - **Project Name**: `opslens` (or whatever)
   - **Framework Preset**: Next.js (auto-detected)
   - **Root Directory**: click **Edit** and set it to `web` ← this is critical
   - **Build Command**: leave default (`next build`)
   - **Output Directory**: leave default

4. Expand **Environment Variables** and add:

   | Key | Value |
   |---|---|
   | `NEXT_PUBLIC_API_URL` | `https://opslens-api.onrender.com` (your Render URL from Step 3) |
   | `NEXT_PUBLIC_WS_URL` | `wss://opslens-api.onrender.com` (same host, `wss://` not `https://`) |

5. Click **Deploy**. Build takes ~90 seconds.
6. After deploy, click **Visit** or copy the production URL — something like
   `https://opslens.vercel.app` or `https://opslens-xxx.vercel.app`.

---

## Step 5 — Wire CORS to the real Vercel URL

Render's backend currently has `CORS_ORIGIN` set to a guess. If your actual
Vercel URL doesn't match, the frontend won't be able to talk to the backend
and you'll see browser console errors like *"Access-Control-Allow-Origin"*.

1. Go back to your Render service → **Environment**
2. Update `CORS_ORIGIN` to the exact Vercel URL you got in Step 4
3. Save changes. Render redeploys (~1 min).

If you have multiple URLs (e.g. the Vercel `opslens.vercel.app` *and* a
custom domain like `opslens.io`), comma-separate them:

```
https://opslens.vercel.app,https://opslens.io,https://www.opslens.io
```

---

## Step 6 — Verify end-to-end

1. Open your Vercel URL in a browser
2. The landing page should look identical to local
3. Click **Open app** → dashboard
4. You should see the 6 seeded demo projects with live sparklines
5. Open one project → live charts should tick once per second
6. Click **⌘K** or **Ask AI** → both should respond

If any of this breaks, scroll to **Troubleshooting**.

---

## Connecting your real Vercel projects

Once the deployment is live:

1. In your deployed app, click **Integrations** in the sidebar
2. Find the Vercel card → click **Connect**
3. Get a token at <https://vercel.com/account/tokens>
4. Paste it into the dialog and click **Connect**

Within ~30 seconds your real Vercel projects appear on the dashboard,
alongside the demo data.

---

## Troubleshooting

### Frontend shows "Couldn't reach the API"

Most common cause on free Render: the backend cold-started. Wait 30–60s and
refresh.

If it persists:
1. `curl https://YOUR-BACKEND.onrender.com/api/health` — does it return JSON?
   If not, check Render logs.
2. Browser DevTools → Network → does the failing request show CORS error in
   the console? If yes, your `CORS_ORIGIN` doesn't match the actual frontend
   URL. Fix it in Step 5.

### WebSocket charts never update

The browser DevTools → Network → filter **WS** should show one connection
when you open a project detail page.

- If the connection shows red/failed: `NEXT_PUBLIC_WS_URL` is wrong. It must
  be `wss://` (not `ws://`) for HTTPS sites.
- If it shows green but no messages: the project might not have
  `live_metrics=true`. Real Vercel projects don't, only demo ones do.

### Render build fails with "no Dockerfile"

`render.yaml` expects `./backend/Dockerfile`. Make sure the file is committed
and the path is correct.

### Neon connection times out

Free Neon databases auto-suspend after a few minutes of inactivity. First
connection takes ~2s while it wakes up. Subsequent connections are instant.
If timeouts persist, check the connection string format —`?sslmode=require`
is required.

### Vercel build fails on React 19 RC

If you see version mismatch warnings: we're pinned to a specific React 19 RC
that Next.js 15.0.3 requires. Make sure `package.json` wasn't auto-bumped.
A clean re-install (`rm -rf node_modules && pnpm install`) usually fixes it.

---

## What this *doesn't* set up

These need separate work — none are blockers for "go live":

- **Custom domain** (e.g. `opslens.io` instead of `opslens.vercel.app`). Both
  Vercel and Render support custom domains in 5 minutes once you have one.
- **Auth / multi-tenancy** — currently single workspace, no login. Anyone
  who hits your URL sees the same dashboard. Fine for portfolio + personal
  use; not fine if you accept paying customers.
- **Real AI** — the assistant is still canned-response keyword matching.
- **More providers** — only Vercel is wired up. Render/Neon/Supabase
  integrations come in follow-up sessions.
