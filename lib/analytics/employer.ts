"use server";

import { supabaseAdmin } from "@/lib/supabase-server";

export interface EmployerStats {
  employer: string;
  learner_count: number;
  avg_pre_score: number | null;
  avg_post_score: number | null;
  avg_score_change: number | null;
  avg_confidence_change: number | null;
}

export async function employerPerformance(minLearners = 1): Promise<EmployerStats[]> {
  const supabase = supabaseAdmin;
  const { data: learners } = await supabase.from("learners").select("id, employer_normalized");
  const { data: parts } = await supabase.from("participations").select("learner_id, pre_score, post_score, score_change, confidence_change");

  if (!learners || !parts) return [];

  const learnerEmployer = new Map<number, string>();
  for (const l of learners) {
    if (l.employer_normalized) learnerEmployer.set(l.id, l.employer_normalized);
  }

  const grouped = new Map<string, { pre: number[]; post: number[]; change: number[]; conf: number[]; ids: Set<number> }>();
  for (const p of parts) {
    const emp = learnerEmployer.get(p.learner_id);
    if (!emp) continue;
    if (!grouped.has(emp)) grouped.set(emp, { pre: [], post: [], change: [], conf: [], ids: new Set() });
    const g = grouped.get(emp)!;
    g.ids.add(p.learner_id);
    if (p.pre_score != null) g.pre.push(p.pre_score);
    if (p.post_score != null) g.post.push(p.post_score);
    if (p.score_change != null) g.change.push(p.score_change);
    if (p.confidence_change != null) g.conf.push(p.confidence_change);
  }

  const avg = (arr: number[]) => arr.length > 0 ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : null;

  return Array.from(grouped.entries())
    .filter(([, g]) => g.ids.size >= minLearners)
    .map(([employer, g]) => ({
      employer,
      learner_count: g.ids.size,
      avg_pre_score: avg(g.pre),
      avg_post_score: avg(g.post),
      avg_score_change: avg(g.change),
      avg_confidence_change: avg(g.conf),
    }))
    .sort((a, b) => (b.avg_score_change ?? 0) - (a.avg_score_change ?? 0));
}
