# Deployment

CareerOS ships as a standard TanStack Start build. The same `dist/` output
runs on **Vercel**, **Docker**, or any Node 20 host.

```
dist/
├── client/   # Static assets served at the root (Vite output)
└── server/   # SSR + server functions + API routes (Web `fetch` handler)
        server.js  →  export default { fetch(request, env, ctx) }
```

`bun run build` produces both. The server bundle exports a standards-based
Web `fetch` handler — every deployment target below just wraps that handler.

---

## 1. Vercel

Files: [`vercel.json`](../vercel.json), [`api/index.mjs`](../api/index.mjs).

- `vercel.json` sets `buildCommand=bun run build`, publishes
  `dist/client` as static output, and rewrites every path to the
  serverless function at `/api/index`.
- `api/index.mjs` adapts the TanStack Start Web `fetch` handler to
  Vercel's Node runtime (`nodejs20.x`). Static assets under
  `dist/client/**` are served directly by Vercel's edge network; only
  unmatched paths fall through to the function.

### Deploy

```bash
# One-time
npm i -g vercel
vercel link

# Configure environment variables (see .env.example for the full list)
vercel env add SUPABASE_URL
vercel env add SUPABASE_PUBLISHABLE_KEY
vercel env add GEMINI_API_KEY
# Public — required at build time so Vite inlines them:
vercel env add VITE_SUPABASE_URL
vercel env add VITE_SUPABASE_PUBLISHABLE_KEY
vercel env add VITE_SUPABASE_PROJECT_ID

# Ship
vercel --prod
```

Push to the connected Git branch to auto-deploy afterwards. Preview
deployments run on every PR.

---

## 2. Docker

Files: [`Dockerfile`](../Dockerfile),
[`docker-compose.yml`](../docker-compose.yml),
[`docker/server.mjs`](../docker/server.mjs),
[`.dockerignore`](../.dockerignore).

Multi-stage build:

1. **build** — `oven/bun:1.1.34-alpine`, installs against the lockfile,
   runs `bun run build`.
2. **runtime** — `node:20-alpine`, ships only `dist/` and a ~90 LOC
   `server.mjs` that serves `dist/client/` statically and forwards
   everything else to the SSR `fetch` handler.

### Build & run

```bash
# Build the image
docker build -t careeros-app:latest .

# Run standalone
docker run --rm -p 8080:8080 --env-file .env careeros-app:latest

# Or with compose
cp .env.example .env      # fill in real values
docker compose up --build
```

Container listens on `:8080` and includes a `HEALTHCHECK`.

---

## 3. Bare Node

```bash
bun install --frozen-lockfile
bun run build
node docker/server.mjs        # or copy it to `server.mjs`
```

Any process manager (systemd, PM2, Kubernetes) can supervise the
resulting process. Set `PORT`, `HOST`, and the variables from
`.env.example`.

---

## Environment variables

See [`.env.example`](../.env.example) for the authoritative list.

| Variable | Where | Notes |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | build + client | Public — inlined into the bundle. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | build + client | Public anon key. |
| `VITE_SUPABASE_PROJECT_ID` | build + client | Public. |
| `SUPABASE_URL` | server | Same value; used by SSR + server fns. |
| `SUPABASE_PUBLISHABLE_KEY` | server | Same value; used by SSR + server fns. |
| `SUPABASE_SERVICE_ROLE_KEY` | server (optional) | Admin ops only — never exposed. |
| `GEMINI_API_KEY` | server | Google Gemini key for AI features. |
| `GEMINI_MODEL` | server (optional) | Defaults to `gemini-2.0-flash`. |
| `PORT` / `HOST` | server | HTTP bind; defaults `8080` / `0.0.0.0`. |

`VITE_*` values must be set **at build time** because Vite inlines them
into the client bundle. Server-only values are read at request time
inside server functions and API routes.

---

## Verification checklist

After deploying, hit:

- `GET /` — SSR home page renders.
- `GET /auth` — auth page renders without hydration warnings.
- `POST /api/graphql` with `{ "query": "{ __typename }" }` — GraphQL responds `200`.
- `GET /extension/careeros-extension.zip` — Chrome extension zip downloads.
- Any authenticated AI page — Resume Analyzer, Job Match, Career Coach,
  Mock Interview, Voice Interview — server functions succeed end-to-end.
