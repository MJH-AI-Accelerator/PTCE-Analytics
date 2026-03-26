"use server";

import { getServiceClient } from "@/lib/supabase";

export interface UnifiedRow {
  learner_name: string;
  email: string;
  employer: string | null;
  pre_score: number | null;
  post_score: number | null;
  score_change: number | null;
  [key: string]: unknown;
}

export async function getUnifiedResponses(activityId?: string): Promise<UnifiedRow[]> {
  const supabase = getServiceClient();
  let pQuery = supabase.from("participations").select("*");
  if (activityId) pQuery = pQuery.eq("activity_id", activityId);
  const { data: parts } = await pQuery;
  if (!parts || parts.length === 0) return [];

  const learnerIds = [...new Set(parts.map((p) => p.learner_id))];
  const { data: learners } = await supabase.from("learners").select("*").in("id", learnerIds);
  const learnerMap = new Map((learners ?? []).map((l) => [l.id, l]));

  return parts.map((p) => {
    const l = learnerMap.get(p.learner_id);
    return {
      learner_name: l ? [l.first_name, l.last_name].filter(Boolean).join(" ") || l.email : "Unknown",
      email: l?.email ?? "",
      employer: l?.employer_normalized ?? null,
      pre_score: p.pre_score,
      post_score: p.post_score,
      score_change: p.score_change,
      pre_confidence: p.pre_confidence_avg,
      post_confidence: p.post_confidence_avg,
      confidence_change: p.confidence_change,
    };
  });
}

export interface QuestionLegendItem {
  key: string;
  text: string;
  type: string;
}

export async function getQuestionLegend(activityId: string): Promise<QuestionLegendItem[]> {
  const supabase = getServiceClient();
  const { data } = await supabase
    .from("questions")
    .select("id, question_text, question_type, question_number")
    .eq("activity_id", activityId)
    .order("question_number");

  return (data ?? []).map((q, i) => ({
    key: `Q${q.question_number ?? i + 1}`,
    text: q.question_text,
    type: q.question_type,
  }));
}
