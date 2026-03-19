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
  try {
    return await storeParsedActivityData(supabase, parsed, activity);
  } catch (err) {
    // Surface the actual error message instead of generic Next.js server error
    return {
      learnersCreated: 0,
      learnersUpdated: 0,
      participationsCreated: 0,
      questionsCreated: 0,
      responsesCreated: 0,
      evaluationResponsesCreated: 0,
      emailAliasesFlagged: 0,
      errors: [err instanceof Error ? err.message : String(err)],
      warnings: [],
    };
  }
}
