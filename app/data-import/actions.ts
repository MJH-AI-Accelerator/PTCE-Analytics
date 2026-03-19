"use server";

import { supabase } from "@/lib/supabase";
import { ingestData, type ActivityMetadata, type IngestResult } from "@/lib/ingestion/pipeline";

export async function importData(
  rows: Record<string, unknown>[],
  mapping: Record<string, string | null>,
  activity: ActivityMetadata
): Promise<IngestResult> {
  return ingestData(supabase, rows, mapping, activity);
}
