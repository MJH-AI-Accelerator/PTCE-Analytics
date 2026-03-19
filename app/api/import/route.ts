import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { storeParsedActivityData, type ActivityMetadata } from "@/lib/ingestion/pipeline";
import type { ParsedActivityData, ParsedLearner } from "@/lib/parsers/types";

interface ImportRequestBody {
  activity: ActivityMetadata;
  learners: ParsedLearner[];
  init?: Omit<ParsedActivityData, "learners">;
  skipActivityUpsert?: boolean;
  skipQuestionUpsert?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const body: ImportRequestBody = await request.json();
    const { activity, learners, init, skipActivityUpsert, skipQuestionUpsert } = body;

    if (!activity?.activity_id || !activity?.activity_name) {
      return NextResponse.json(
        { error: "Missing activity_id or activity_name" },
        { status: 400 }
      );
    }

    // Build ParsedActivityData from the request
    const parsed: ParsedActivityData = {
      source: init?.source ?? "array",
      sourceFileName: init?.sourceFileName ?? "",
      suggestedActivityName: init?.suggestedActivityName ?? null,
      questions: init?.questions ?? [],
      learners,
      warnings: init?.warnings ?? [],
      excludedCount: init?.excludedCount ?? 0,
      metadata: init?.metadata ?? {},
      mergedSources: init?.mergedSources,
    };

    const supabase = getServiceClient();
    const result = await storeParsedActivityData(supabase, parsed, activity, {
      skipActivityUpsert: skipActivityUpsert ?? !init,
      skipQuestionUpsert: skipQuestionUpsert ?? !init,
    });

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[api/import] ERROR:", message);
    console.error("[api/import] Stack:", err instanceof Error ? err.stack : "");

    return NextResponse.json(
      {
        learnersCreated: 0,
        learnersUpdated: 0,
        participationsCreated: 0,
        questionsCreated: 0,
        responsesCreated: 0,
        evaluationResponsesCreated: 0,
        emailAliasesFlagged: 0,
        errors: [`Server error: ${message}`],
        warnings: [],
      },
      { status: 200 } // Return 200 so the client can read the error details
    );
  }
}
