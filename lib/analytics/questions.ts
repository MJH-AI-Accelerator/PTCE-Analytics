"use server";

import { getServiceClient } from "@/lib/supabase";

export interface QuestionStats {
  question_text: string;
  question_type: string;
  category: string | null;
  pre_correct_pct: number | null;
  post_correct_pct: number | null;
  change: number | null;
  n_responses: number;
}

export async function questionLevelAnalysis(activityId?: string): Promise<QuestionStats[]> {
  const supabase = getServiceClient();
  let qQuery = supabase.from("questions").select("id, question_text, question_type, question_category, activity_id");
  if (activityId) qQuery = qQuery.eq("activity_id", activityId);
  const { data: questions } = await qQuery;
  if (!questions) return [];

  const qIds = questions.map((q) => q.id);
  if (qIds.length === 0) return [];

  const { data: responses } = await supabase
    .from("question_responses")
    .select("question_id, phase, is_correct")
    .in("question_id", qIds);

  const stats = new Map<number, { preCor: number; preTotal: number; postCor: number; postTotal: number }>();
  for (const r of responses ?? []) {
    if (!stats.has(r.question_id)) stats.set(r.question_id, { preCor: 0, preTotal: 0, postCor: 0, postTotal: 0 });
    const s = stats.get(r.question_id)!;
    if (r.phase === "pre") { s.preTotal++; if (r.is_correct) s.preCor++; }
    else { s.postTotal++; if (r.is_correct) s.postCor++; }
  }

  return questions.map((q) => {
    const s = stats.get(q.id);
    const prePct = s && s.preTotal > 0 ? Math.round((s.preCor / s.preTotal) * 1000) / 10 : null;
    const postPct = s && s.postTotal > 0 ? Math.round((s.postCor / s.postTotal) * 1000) / 10 : null;
    return {
      question_text: q.question_text,
      question_type: q.question_type,
      category: q.question_category,
      pre_correct_pct: prePct,
      post_correct_pct: postPct,
      change: prePct != null && postPct != null ? Math.round((postPct - prePct) * 10) / 10 : null,
      n_responses: s ? s.preTotal + s.postTotal : 0,
    };
  });
}

export async function categoryLevelAnalysis(): Promise<{ category: string; avg_pre: number | null; avg_post: number | null; change: number | null }[]> {
  const questions = await questionLevelAnalysis();
  const grouped = new Map<string, { pre: number[]; post: number[] }>();

  for (const q of questions) {
    const cat = q.category ?? "Uncategorized";
    if (!grouped.has(cat)) grouped.set(cat, { pre: [], post: [] });
    const g = grouped.get(cat)!;
    if (q.pre_correct_pct != null) g.pre.push(q.pre_correct_pct);
    if (q.post_correct_pct != null) g.post.push(q.post_correct_pct);
  }

  const avg = (arr: number[]) => arr.length > 0 ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : null;

  return Array.from(grouped.entries()).map(([category, g]) => {
    const avgPre = avg(g.pre);
    const avgPost = avg(g.post);
    return {
      category,
      avg_pre: avgPre,
      avg_post: avgPost,
      change: avgPre != null && avgPost != null ? Math.round((avgPost - avgPre) * 10) / 10 : null,
    };
  });
}
