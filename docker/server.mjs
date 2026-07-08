// Minimal Node HTTP server that mounts the TanStack Start `fetch` handler
// from `dist/server/server.js` and serves static assets from `dist/client/`.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { Readable } from "node:stream";
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

// The Dockerfile copies this file to `/app/server.mjs` (sibling of `dist/`).
// When invoked from a repo checkout (`node docker/server.mjs`), `dist/` lives
// one level up. Prefer sibling, fall back to the project root.
const SIBLING_DIST = resolve(__dirname, "dist");
const PARENT_DIST = resolve(__dirname, "..", "dist");
const DIST_DIR = existsSync(SIBLING_DIST) ? SIBLING_DIST : PARENT_DIST;
const CLIENT_DIR = resolve(DIST_DIR, "client");
const SERVER_ENTRY = resolve(DIST_DIR, "server", "server.js");

const handler = (await import(pathToFileURL(SERVER_ENTRY).href)).default;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".zip": "application/zip",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json; charset=utf-8",
};

async function tryServeStatic(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") return false;
  const urlPath = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const rel = normalize(urlPath).replace(/^\/+/, "");
  const filePath = join(CLIENT_DIR, rel);
  if (!filePath.startsWith(CLIENT_DIR)) return false;
  try {
    const info = await stat(filePath);
    if (!info.isFile()) return false;
    const ext = extname(filePath).toLowerCase();
    res.statusCode = 200;
    res.setHeader("content-type", MIME[ext] || "application/octet-stream");
    res.setHeader("content-length", info.size);
    if (rel.startsWith("assets/")) {
      res.setHeader("cache-control", "public, max-age=31536000, immutable");
    }
    if (req.method === "HEAD") {
      res.end();
      return true;
    }
    const buf = await readFile(filePath);
    res.end(buf);
    return true;
  } catch {
    return false;
  }
}

function buildRequest(req) {
  const proto = req.headers["x-forwarded-proto"] || "http";
  const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost";
  const url = `${proto}://${host}${req.url}`;

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) for (const v of value) headers.append(key, v);
    else if (value !== undefined) headers.set(key, String(value));
  }

  const method = req.method || "GET";
  const init = { method, headers };
  if (method !== "GET" && method !== "HEAD") {
    init.body = req;
    init.duplex = "half";
  }
  return new Request(url, init);
}

const server = createServer(async (req, res) => {
  try {
    if (await tryServeStatic(req, res)) return;
    const response = await handler.fetch(buildRequest(req), {}, {});
    res.statusCode = response.status;
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() === "content-encoding") return;
      res.setHeader(key, value);
    });
    if (!response.body) {
      res.end();
      return;
    }
    Readable.fromWeb(response.body).pipe(res);
  } catch (err) {
    console.error("[docker] SSR handler failed", err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("content-type", "text/plain; charset=utf-8");
    }
    res.end("Internal Server Error");
  }
});

const port = Number(process.env.PORT) || 8080;
const host = process.env.HOST || "0.0.0.0";
server.listen(port, host, () => {
  console.log(`[docker] listening on http://${host}:${port}`);
});
