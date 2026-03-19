import { supabase } from "@/lib/supabase";

export interface EvalSummary {
  question_text: string;
  category: string | null;
  responses: { value: string; count: number }[];
  total: number;
}

export async function evaluationAnalysis(activityId?: string): Promise<EvalSummary[]> {
  let query = supabase.from("evaluation_responses").select("eval_question_text, eval_category, response_text, participation_id");
  if (activityId) {
    const { data: parts } = await supabase.from("participations").select("id").eq("activity_id", activityId);
    const partIds = (parts ?? []).map((p) => p.id);
    if (partIds.length === 0) return [];
    query = query.in("participation_id", partIds);
  }

  const { data } = await query;
  if (!data) return [];

  const grouped = new Map<string, { category: string | null; responses: Map<string, number> }>();
  for (const r of data) {
    const key = r.eval_question_text;
    if (!grouped.has(key)) grouped.set(key, { category: r.eval_category, responses: new Map() });
    const g = grouped.get(key)!;
    const val = r.response_text ?? "(no response)";
    g.responses.set(val, (g.responses.get(val) ?? 0) + 1);
  }

  return Array.from(grouped.entries()).map(([question_text, g]) => ({
    question_text,
    category: g.category,
    responses: Array.from(g.responses.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count),
    total: Array.from(g.responses.values()).reduce((a, b) => a + b, 0),
  }));
}

export async function intendedChangesSummary(): Promise<{ change: string; count: number }[]> {
  const { data } = await supabase
    .from("evaluation_responses")
    .select("response_text")
    .eq("eval_category", "intended_change")
    .not("response_text", "is", null);

  const counts = new Map<string, number>();
  for (const r of data ?? []) {
    const val = r.response_text!;
    counts.set(val, (counts.get(val) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([change, count]) => ({ change, count }))
    .sort((a, b) => b.count - a.count);
}

export async function barriersSummary(): Promise<{ barrier: string; count: number }[]> {
  const { data } = await supabase
    .from("evaluation_responses")
    .select("response_text")
    .eq("eval_category", "barrier")
    .not("response_text", "is", null);

  const counts = new Map<string, number>();
  for (const r of data ?? []) {
    const val = r.response_text!;
    counts.set(val, (counts.get(val) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([barrier, count]) => ({ barrier, count }))
    .sort((a, b) => b.count - a.count);
}
