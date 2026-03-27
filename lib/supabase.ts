import { createClient } from "@supabase/supabase-js";

// Public anon-key client for future client-side auth (Supabase Auth).
// All server-side data access uses lib/supabase-server.ts instead.
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
