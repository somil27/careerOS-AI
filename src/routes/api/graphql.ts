import { createFileRoute } from "@tanstack/react-router";
import { serveGraphql } from "@/lib/graphql/handler";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Requested-With, Accept, Origin, apollo-require-preflight, x-apollo-operation-name",
  "Access-Control-Max-Age": "86400",
} as const;

function withCors(res: Response): Response {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(CORS_HEADERS)) headers.set(k, v);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

async function handle(request: Request): Promise<Response> {
  return withCors(await serveGraphql(request));
}

// Note: duplicate @tanstack/router-core versions in the dep tree prevent the
// `server` option's module augmentation from reaching this file's typechecker.
// The runtime shape is correct; cast to bypass the mismatched type only.
type ServerHandler = (ctx: { request: Request }) => Promise<Response> | Response;
const routeOptions = {
  server: {
    handlers: {
      OPTIONS: (async () => new Response(null, { status: 204, headers: CORS_HEADERS })) satisfies ServerHandler,
      GET: (async ({ request }) => handle(request)) satisfies ServerHandler,
      POST: (async ({ request }) => handle(request)) satisfies ServerHandler,
    },
  },
} as unknown as Parameters<ReturnType<typeof createFileRoute<"/api/graphql">>>[0];

export const Route = createFileRoute("/api/graphql")(routeOptions);
