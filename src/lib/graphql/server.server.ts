// Server-only GraphQL setup. Imported dynamically from the /api/graphql route
// handler so the yoga runtime and per-request Supabase clients never enter the
// client bundle graph.
import { createYoga, createSchema } from "graphql-yoga";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import DataLoader from "dataloader";
import { GraphQLError } from "graphql";
import type { Database } from "@/integrations/supabase/types";
import { typeDefs } from "./schema";
import { buildResolvers } from "./resolvers";

export type Ctx = {
  userId: string | null;
  email: string | null;
  supabase: SupabaseClient<Database>;
  supabaseAnon: SupabaseClient<Database>;
  loaders: ReturnType<typeof buildLoaders>;
  requireAuth: () => string;
};

function buildLoaders(supabase: SupabaseClient<Database>) {
  return {
    profileById: new DataLoader<string, Database["public"]["Tables"]["profiles"]["Row"] | null>(async (ids) => {
      const { data } = await supabase.from("profiles").select("*").in("id", ids as string[]);
      const map = new Map((data ?? []).map((r) => [r.id, r]));
      return ids.map((id) => map.get(id) ?? null);
    }),
    applicationById: new DataLoader<string, Database["public"]["Tables"]["applications"]["Row"] | null>(async (ids) => {
      const { data } = await supabase.from("applications").select("*").in("id", ids as string[]).is("deleted_at", null);
      const map = new Map((data ?? []).map((r) => [r.id, r]));
      return ids.map((id) => map.get(id) ?? null);
    }),
    resumeById: new DataLoader<string, Database["public"]["Tables"]["resumes"]["Row"] | null>(async (ids) => {
      const { data } = await supabase.from("resumes").select("*").in("id", ids as string[]).is("deleted_at", null);
      const map = new Map((data ?? []).map((r) => [r.id, r]));
      return ids.map((id) => map.get(id) ?? null);
    }),
    activitiesByApplication: new DataLoader<string, Database["public"]["Tables"]["application_activities"]["Row"][]>(
      async (appIds) => {
        const { data } = await supabase
          .from("application_activities")
          .select("*")
          .in("application_id", appIds as string[])
          .order("created_at", { ascending: false });
        const groups = new Map<string, Database["public"]["Tables"]["application_activities"]["Row"][]>();
        for (const row of data ?? []) {
          const bucket = groups.get(row.application_id) ?? [];
          bucket.push(row);
          groups.set(row.application_id, bucket);
        }
        return appIds.map((id) => groups.get(id) ?? []);
      },
    ),
  };
}

export async function buildContext(request: Request): Promise<Ctx> {
  const url = process.env.SUPABASE_URL!;
  const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY!;
  const auth = request.headers.get("authorization") ?? request.headers.get("Authorization");
  const token = auth?.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : null;

  const supabaseAnon = createClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
  });

  let userId: string | null = null;
  let email: string | null = null;
  if (token) {
    const { data, error } = await supabaseAnon.auth.getUser(token);
    if (!error && data.user) {
      userId = data.user.id;
      email = data.user.email ?? null;
    }
  }

  const supabase = token
    ? createClient<Database>(url, anonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
      })
    : supabaseAnon;

  const loaders = buildLoaders(supabase);
  return {
    userId,
    email,
    supabase,
    supabaseAnon,
    loaders,
    requireAuth: () => {
      if (!userId) {
        throw new GraphQLError("Authentication required", { extensions: { code: "UNAUTHENTICATED", http: { status: 401 } } });
      }
      return userId;
    },
  };
}

let cachedYoga: ReturnType<typeof createYoga<any, any>> | null = null;

export function getYoga() {
  if (cachedYoga) return cachedYoga;
  const schema = createSchema({ typeDefs, resolvers: buildResolvers() as any });
  cachedYoga = createYoga<any, any>({
    schema,
    graphqlEndpoint: "/api/graphql",
    landingPage: false,
    graphiql: {
      title: "CareerOS AI · GraphQL Playground",
      defaultQuery: `# Welcome to the CareerOS AI GraphQL API
# Send an Authorization: Bearer <access_token> header (Headers tab below)
# to access user-scoped data. Explore the schema in the Docs panel.

query Me {
  me {
    id
    email
    profile { fullName targetRole }
    stats { applications resumes interviews }
  }
}
`,
    },
    maskedErrors: false,
    context: ({ request }: { request: Request }) => buildContext(request),
  });
  return cachedYoga;
}
