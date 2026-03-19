import { createClient, SupabaseClient } from "@supabase/supabase-js";

// NEXT_PUBLIC_ vars are inlined at build time for client code.
// For server-side (API routes), also check non-prefixed fallbacks at runtime.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "placeholder";

// Using untyped client — table types are in lib/database.types.ts for reference
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabase: SupabaseClient<any, "public", any> = createClient(supabaseUrl, supabaseAnonKey);

export function getServiceClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder";
  return createClient(supabaseUrl, serviceRoleKey);
}
