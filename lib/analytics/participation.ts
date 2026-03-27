"use server";

import { supabaseAdmin } from "@/lib/supabase-server";

export interface DepthSegment {
  segment: string;
  learner_count: number;
  avg_pre_score: number | null;
  avg_post_score: number | null;
  avg_score_change: number | null;
}

export async function participationDepth(): Promise<DepthSegment[]> {
  const supabase = supabaseAdmin;
  const { data: parts } = await supabase.from("participations").select("learner_id, pre_score, post_score, score_change");
  if (!parts) return [];

  const byLearner = new Map<number, typeof parts>();
  for (const p of parts) {
    if (!byLearner.has(p.learner_id)) byLearner.set(p.learner_id, []);
    byLearner.get(p.learner_id)!.push(p);
  }

  const segments: Record<string, { pre: number[]; post: number[]; change: number[]; ids: Set<number> }> = {
    "1 Activity": { pre: [], post: [], change: [], ids: new Set() },
    "2-3 Activities": { pre: [], post: [], change: [], ids: new Set() },
    "4+ Activities": { pre: [], post: [], change: [], ids: new Set() },
  };

  for (const [learnerId, recs] of byLearner) {
    const seg = recs.length === 1 ? "1 Activity" : recs.length <= 3 ? "2-3 Activities" : "4+ Activities";
    segments[seg].ids.add(learnerId);
    for (const p of recs) {
      if (p.pre_score != null) segments[seg].pre.push(p.pre_score);
      if (p.post_score != null) segments[seg].post.push(p.post_score);
      if (p.score_change != null) segments[seg].change.push(p.score_change);
    }
  }

  const avg = (arr: number[]) => arr.length > 0 ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : null;

  return Object.entries(segments).map(([segment, g]) => ({
    segment,
    learner_count: g.ids.size,
    avg_pre_score: avg(g.pre),
    avg_post_score: avg(g.post),
    avg_score_change: avg(g.change),
  }));
}

export interface SettingBreakdown {
  setting: string;
  count: number;
  avg_score_change: number | null;
}

export async function practiceSettingBreakdown(): Promise<SettingBreakdown[]> {
  const supabase = supabaseAdmin;
  const { data: learners } = await supabase.from("learners").select("id, practice_setting");
  const { data: parts } = await supabase.from("participations").select("learner_id, score_change");
  if (!learners || !parts) return [];

  const learnerSetting = new Map<number, string>();
  for (const l of learners) {
    if (l.practice_setting) learnerSetting.set(l.id, l.practice_setting);
  }

  const grouped = new Map<string, { count: number; changes: number[] }>();
  for (const p of parts) {
    const setting = learnerSetting.get(p.learner_id) ?? "Unknown";
    if (!grouped.has(setting)) grouped.set(setting, { count: 0, changes: [] });
    const g = grouped.get(setting)!;
    g.count++;
    if (p.score_change != null) g.changes.push(p.score_change);
  }

  const avg = (arr: number[]) => arr.length > 0 ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : null;

  return Array.from(grouped.entries())
    .map(([setting, g]) => ({ setting, count: g.count, avg_score_change: avg(g.changes) }))
    .sort((a, b) => b.count - a.count);
}
