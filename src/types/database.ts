/**
 * Convenience re-exports for the auto-generated Supabase database types.
 * Prefer importing from `@/types/database` in feature code so we can
 * evolve the shape without touching every call site.
 */
export type { Database, Json, Tables, TablesInsert, TablesUpdate, Enums } from "@/integrations/supabase/types";
