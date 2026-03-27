"use server";

import { supabaseAdmin } from "@/lib/supabase-server";
import { applyAlias } from "@/lib/ingestion/employer-matcher";

export async function serverApplyAlias(rawName: string, canonicalName: string): Promise<void> {
  const supabase = supabaseAdmin;
  await applyAlias(supabase, rawName, canonicalName, "fuzzy_accepted");
}
