import { SupabaseClient } from "@supabase/supabase-js";
import type { ParsedQuestion, ParsedLearnerResponse } from "@/lib/parsers/types";

/**
 * Upsert questions for an activity and return a map of questionNumber → question ID.
 */
export async function upsertQuestions(
  supabase: SupabaseClient,
  activityId: string,
  questions: ParsedQuestion[]
): Promise<Map<number, number>> {
  const questionIdMap = new Map<number, number>();

  for (const q of questions) {
    // Check if question already exists for this activity
    const { data: existing } = await supabase
      .from("questions")
      .select("id")
      .eq("activity_id", activityId)
      .eq("question_number", q.questionNumber)
      .eq("question_type", q.questionType)
      .single();

    if (existing) {
      // Update if needed
      await supabase
        .from("questions")
        .update({
          question_text: q.questionText,
          question_category: q.questionCategory ?? null,
          correct_answer: q.correctAnswer ?? null,
        })
        .eq("id", existing.id);
      questionIdMap.set(q.questionNumber, existing.id);
    } else {
      // Insert new question
      const { data: created, error } = await supabase
        .from("questions")
        .insert({
          activity_id: activityId,
          question_number: q.questionNumber,
          question_text: q.questionText,
          question_type: q.questionType,
          question_category: q.questionCategory ?? null,
          correct_answer: q.correctAnswer ?? null,
        })
        .select("id")
        .single();

      if (error) throw error;
      questionIdMap.set(q.questionNumber, created!.id);
    }
  }

  return questionIdMap;
}

/**
 * Insert question responses for a participation.
 * Returns count of responses inserted.
 */
export async function insertQuestionResponses(
  supabase: SupabaseClient,
  participationId: number,
  responses: ParsedLearnerResponse[],
  questionIdMap: Map<number, number>
): Promise<number> {
  let count = 0;

  // Delete existing responses for this participation to avoid duplicates
  await supabase.from("question_responses").delete().eq("participation_id", participationId);

  const inserts = responses
    .filter((r) => questionIdMap.has(r.questionNumber))
    .map((r) => ({
      participation_id: participationId,
      question_id: questionIdMap.get(r.questionNumber)!,
      phase: r.phase,
      learner_answer: r.learnerAnswer,
      is_correct: r.isCorrect,
      numeric_value: r.numericValue,
    }));

  if (inserts.length > 0) {
    // Batch insert in chunks of 100
    for (let i = 0; i < inserts.length; i += 100) {
      const chunk = inserts.slice(i, i + 100);
      const { error } = await supabase.from("question_responses").insert(chunk);
      if (error) throw error;
      count += chunk.length;
    }
  }

  return count;
}
