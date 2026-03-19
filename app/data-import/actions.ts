"use server";

import { supabase } from "@/lib/supabase";
import { ingestData, storeParsedActivityData, type ActivityMetadata, type IngestResult } from "@/lib/ingestion/pipeline";
import type { ParsedActivityData, ParsedLearner } from "@/lib/parsers/types";

/** Legacy import using column mapping */
export async function importData(
  rows: Record<string, unknown>[],
  mapping: Record<string, string | null>,
  activity: ActivityMetadata
): Promise<IngestResult> {
  return ingestData(supabase, rows, mapping, activity);
}

/** Import a single chunk of learners for an already-initialized activity */
export async function importLearnerBatch(
  activityId: string,
  learners: ParsedLearner[],
  activity: ActivityMetadata,
  /** Pass questions + metadata only on the first chunk to set up the activity */
  init?: {
    parsed: Omit<ParsedActivityData, "learners">;
  }
): Promise<IngestResult> {
  try {
    // Build a ParsedActivityData with just this batch of learners
    const parsed: ParsedActivityData = {
      source: init?.parsed.source ?? "array",
      sourceFileName: init?.parsed.sourceFileName ?? "",
      suggestedActivityName: init?.parsed.suggestedActivityName ?? null,
      questions: init?.parsed.questions ?? [],
      learners,
      warnings: init?.parsed.warnings ?? [],
      excludedCount: init?.parsed.excludedCount ?? 0,
      metadata: init?.parsed.metadata ?? {},
      mergedSources: init?.parsed.mergedSources,
    };

    return await storeParsedActivityData(supabase, parsed, activity, {
      skipActivityUpsert: !init,
      skipQuestionUpsert: !init,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[importLearnerBatch] ERROR:", message);
    return {
      learnersCreated: 0,
      learnersUpdated: 0,
      participationsCreated: 0,
      questionsCreated: 0,
      responsesCreated: 0,
      evaluationResponsesCreated: 0,
      emailAliasesFlagged: 0,
      errors: [`Server error: ${message}`],
      warnings: [],
    };
  }
}

/** New CIR-based import using parsed activity data — single call for small datasets */
export async function importParsedData(
  parsed: ParsedActivityData,
  activity: ActivityMetadata
): Promise<IngestResult> {
  try {
    return await storeParsedActivityData(supabase, parsed, activity);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[importParsedData] ERROR:", message);
    return {
      learnersCreated: 0,
      learnersUpdated: 0,
      participationsCreated: 0,
      questionsCreated: 0,
      responsesCreated: 0,
      evaluationResponsesCreated: 0,
      emailAliasesFlagged: 0,
      errors: [`Server error: ${message}`],
      warnings: [],
    };
  }
}
