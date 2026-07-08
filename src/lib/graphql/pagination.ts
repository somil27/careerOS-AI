// Cursor helpers — opaque base64 of `<isoTimestamp>|<uuid>` for stable pagination.
export type Cursor = { ts: string; id: string };

export function encodeCursor(c: Cursor): string {
  return Buffer.from(`${c.ts}|${c.id}`, "utf8").toString("base64url");
}
export function decodeCursor(s: string | null | undefined): Cursor | null {
  if (!s) return null;
  try {
    const raw = Buffer.from(s, "base64url").toString("utf8");
    const [ts, id] = raw.split("|");
    if (!ts || !id) return null;
    return { ts, id };
  } catch {
    return null;
  }
}

export function clampPageSize(n: number | null | undefined, def = 20, max = 100) {
  if (!n || n <= 0) return def;
  return Math.min(n, max);
}

/**
 * Applies keyset pagination on a Supabase query builder ordered by (created_at desc, id desc).
 * Returns { rows, hasNext, edges, pageInfo }. Fetches (limit+1) to detect a next page.
 */
export async function paginate<Row extends { id: string; created_at: string }>(
  buildQuery: () => Promise<{ data: Row[] | null; error: { message: string } | null; count: number | null }>,
  limit: number,
) {
  const { data, error, count } = await buildQuery();
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const hasNext = rows.length > limit;
  const trimmed = hasNext ? rows.slice(0, limit) : rows;
  const edges = trimmed.map((r) => ({ cursor: encodeCursor({ ts: r.created_at, id: r.id }), node: r }));
  return {
    edges,
    nodes: trimmed,
    totalCount: count ?? trimmed.length,
    pageInfo: {
      hasNextPage: hasNext,
      hasPreviousPage: false,
      startCursor: edges[0]?.cursor ?? null,
      endCursor: edges[edges.length - 1]?.cursor ?? null,
    },
  };
}

/** Build an `.or(...)` filter that skips rows at/before the given cursor. */
export function afterCursorFilter(after: Cursor | null): { orClause: string | null } {
  if (!after) return { orClause: null };
  // (created_at < ts) OR (created_at = ts AND id < id)
  return { orClause: `created_at.lt.${after.ts},and(created_at.eq.${after.ts},id.lt.${after.id})` };
}
