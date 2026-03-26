"use server";

import { getServiceClient } from "@/lib/supabase";
import { applyAlias } from "@/lib/ingestion/employer-matcher";

export async function serverApplyAlias(rawName: string, canonicalName: string): Promise<void> {
  const supabase = getServiceClient();
  await applyAlias(supabase, rawName, canonicalName, "fuzzy_accepted");
}
