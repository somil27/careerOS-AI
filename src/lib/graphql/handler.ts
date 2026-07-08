import { createServerOnlyFn } from "@tanstack/react-start";

// Bridge module: no `.server` extension so the client-import-protection plugin
// does not flag it, but the `createServerOnlyFn` body is stripped from the
// client bundle — taking the `.server.ts` import with it. The route file
// (`src/routes/api/graphql.ts`) imports only from this bridge.
export const serveGraphql = createServerOnlyFn(async (request: Request): Promise<Response> => {
  const { getYoga } = await import("./server.server");
  return getYoga().handle(request, {});
});
