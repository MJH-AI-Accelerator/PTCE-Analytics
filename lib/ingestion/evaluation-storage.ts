import { SupabaseClient } from "@supabase/supabase-js";
import type { ParsedEvaluationResponse } from "@/lib/parsers/types";

/**
 * Insert evaluation responses for a participation.
 * Handles multi-select splitting (already split by parser).
 * Returns count of responses inserted.
 */
export async function insertEvaluationResponses(
  supabase: SupabaseClient,
  participationId: number,
  responses: ParsedEvaluationResponse[]
): Promise<number> {
  if (responses.length === 0) return 0;

  // Delete existing evaluation responses for this participation
  await supabase.from("evaluation_responses").delete().eq("participation_id", participationId);

  const inserts = responses.map((r) => ({
    participation_id: participationId,
    eval_question_text: r.questionText,
    eval_category: r.evalCategory,
    response_text: r.responseText,
    response_numeric: r.responseNumeric,
    faculty_name: r.facultyName ?? null,
  }));

  let count = 0;
  // Batch insert in chunks of 100
  for (let i = 0; i < inserts.length; i += 100) {
    const chunk = inserts.slice(i, i + 100);
    const { error } = await supabase.from("evaluation_responses").insert(chunk);
    if (error) throw error;
    count += chunk.length;
  }

  return count;
}
