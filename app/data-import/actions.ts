"use server";

import { supabase } from "@/lib/supabase";
import { ingestData, storeParsedActivityData, type ActivityMetadata, type IngestResult } from "@/lib/ingestion/pipeline";
import type { ParsedActivityData } from "@/lib/parsers/types";

/** Legacy import using column mapping */
export async function importData(
  rows: Record<string, unknown>[],
  mapping: Record<string, string | null>,
  activity: ActivityMetadata
): Promise<IngestResult> {
  return ingestData(supabase, rows, mapping, activity);
}

/** New CIR-based import using parsed activity data */
export async function importParsedData(
  parsed: ParsedActivityData,
  activity: ActivityMetadata
): Promise<IngestResult> {
  return storeParsedActivityData(supabase, parsed, activity);
}
