import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-server";
import { storeParsedActivityData } from "@/lib/ingestion/pipeline";
import type { ParsedActivityData } from "@/lib/parsers/types";
import { validateOrigin } from "@/lib/api/csrf";
import { rateLimit } from "@/lib/api/rate-limit";

// --- Zod schemas ---

const ActivitySchema = z.object({
  activity_id: z.string().min(1).max(200),
  activity_name: z.string().min(1).max(500),
  activity_type: z.string().max(200).optional(),
  activity_date: z.string().max(100).optional(),
  therapeutic_area: z.string().max(200).optional(),
  disease_state: z.string().max(200).optional(),
  sponsor: z.string().max(200).optional(),
});

const LearnerResponseSchema = z.object({
  questionNumber: z.number(),
  phase: z.enum(["pre", "post"]),
  learnerAnswer: z.string().nullable(),
  isCorrect: z.boolean().nullable(),
  numericValue: z.number().nullable(),
});

const EvaluationResponseSchema = z.object({
  questionNumber: z.number(),
  questionText: z.string(),
  evalCategory: z.enum(["practice_profile", "intended_change", "barrier", "demographic", "custom", "faculty_rating", "overall_rating", "learning_objective_rating"]),
  responseText: z.string().nullable(),
  responseNumeric: z.number().nullable(),
  facultyName: z.string().optional(),
});

const PresenterResponseSchema = z.object({
  questionNumber: z.number(),
  questionText: z.string(),
  responseText: z.string().nullable(),
});

const LearnerSchema = z.object({
  email: z.string().email().max(255),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  employer: z.string().nullable(),
  practiceSetting: z.string().nullable(),
  role: z.string().nullable(),
  demographics: z.record(z.string(), z.string().nullable()),
  responses: z.array(LearnerResponseSchema),
  evaluationResponses: z.array(EvaluationResponseSchema),
  presenterResponses: z.array(PresenterResponseSchema),
  preScore: z.number().nullable(),
  postScore: z.number().nullable(),
  scoreChange: z.number().nullable(),
  preConfidenceAvg: z.number().nullable(),
  postConfidenceAvg: z.number().nullable(),
  confidenceChange: z.number().nullable(),
  comments: z.string().nullable(),
});

const QuestionSchema = z.object({
  questionNumber: z.number(),
  questionText: z.string(),
  questionType: z.enum(["assessment", "confidence", "evaluation", "pulse", "ars"]),
  questionCategory: z.string().optional(),
  correctAnswer: z.string().optional(),
  evalCategory: z.enum(["practice_profile", "intended_change", "barrier", "demographic", "custom", "faculty_rating", "overall_rating", "learning_objective_rating"]).optional(),
  facultyName: z.string().optional(),
});

const WarningSchema = z.object({
  type: z.enum(["exclusion", "data_quality", "missing_data", "format"]),
  message: z.string(),
  context: z.string().optional(),
});

const InitSchema = z.object({
  source: z.enum(["array", "globalmeet", "pigeonhole", "snowflake_eval", "snowflake_ondemand"]),
  sourceFileName: z.string(),
  suggestedActivityName: z.string().nullable(),
  questions: z.array(QuestionSchema),
  warnings: z.array(WarningSchema),
  excludedCount: z.number(),
  metadata: z.record(z.string(), z.string()),
  mergedSources: z.array(z.enum(["array", "globalmeet", "pigeonhole", "snowflake_eval", "snowflake_ondemand"])).optional(),
});

const ImportRequestSchema = z.object({
  activity: ActivitySchema,
  learners: z.array(LearnerSchema).min(1).max(50000),
  init: InitSchema.optional(),
  skipActivityUpsert: z.boolean().optional(),
  skipQuestionUpsert: z.boolean().optional(),
});

// --- Error response helper ---

const emptyResult = {
  learnersCreated: 0,
  learnersUpdated: 0,
  participationsCreated: 0,
  questionsCreated: 0,
  responsesCreated: 0,
  evaluationResponsesCreated: 0,
  emailAliasesFlagged: 0,
  warnings: [],
};

export async function POST(request: NextRequest) {
  try {
    // CSRF check
    if (!validateOrigin(request)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Rate limiting
    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const { success: withinLimit } = rateLimit(`import:${clientIp}`, 20, 60_000);
    if (!withinLimit) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    // Authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Validate request body
    const rawBody = await request.json();
    const parseResult = ImportRequestSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parseResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { activity, learners, init, skipActivityUpsert, skipQuestionUpsert } = parseResult.data;

    // Build ParsedActivityData from the validated request
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

    const supabase = supabaseAdmin;

    // Test connectivity with a simple query
    const { error: pingError } = await supabase.from("activities").select("activity_id").limit(1);
    if (pingError) {
      console.error("[api/import] Supabase connection failed:", pingError.message);
      return NextResponse.json(
        { ...emptyResult, errors: ["Database connection failed. Please try again later."] },
        { status: 503 }
      );
    }

    const result = await storeParsedActivityData(supabase, parsed, activity, {
      skipActivityUpsert: skipActivityUpsert ?? !init,
      skipQuestionUpsert: skipQuestionUpsert ?? !init,
    });

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[api/import] ERROR:", message);
    if (err instanceof Error && err.stack) {
      console.error("[api/import] Stack:", err.stack);
    }

    return NextResponse.json(
      { ...emptyResult, errors: ["An unexpected error occurred. Please try again."] },
      { status: 500 }
    );
  }
}
