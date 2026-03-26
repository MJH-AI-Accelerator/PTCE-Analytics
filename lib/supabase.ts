import { createClient, SupabaseClient } from "@supabase/supabase-js";

function requireEnv(name: string, ...fallbacks: string[]): string {
  for (const key of [name, ...fallbacks]) {
    const value = process.env[key];
    if (value) return value;
  }
  throw new Error(`Missing required environment variable: ${[name, ...fallbacks].join(" or ")}`);
}

const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL");

// Cached service client singleton (server-side only)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _serviceClient: SupabaseClient<any, "public", any> | null = null;

export function getServiceClient() {
  if (_serviceClient) return _serviceClient;
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  _serviceClient = createClient(supabaseUrl, serviceRoleKey);
  return _serviceClient;
}
