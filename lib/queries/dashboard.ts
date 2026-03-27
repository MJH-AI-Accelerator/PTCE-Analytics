"use server";

import { supabaseAdmin } from "@/lib/supabase-server";

export interface DashboardMetrics {
  totalLearners: number;
  totalParticipations: number;
  totalActivities: number;
  avgScoreChange: number | null;
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const supabase = supabaseAdmin;
  const [learners, participations, activities, scores] = await Promise.all([
    supabase.from("learners").select("*", { count: "exact", head: true }),
    supabase.from("participations").select("*", { count: "exact", head: true }),
    supabase.from("activities").select("*", { count: "exact", head: true }),
    supabase.from("participations").select("score_change").not("score_change", "is", null),
  ]);

  let avgScoreChange: number | null = null;
  if (scores.data && scores.data.length > 0) {
    const sum = scores.data.reduce((acc, r) => acc + (r.score_change ?? 0), 0);
    avgScoreChange = Math.round((sum / scores.data.length) * 10) / 10;
  }

  return {
    totalLearners: learners.count ?? 0,
    totalParticipations: participations.count ?? 0,
    totalActivities: activities.count ?? 0,
    avgScoreChange,
  };
}
