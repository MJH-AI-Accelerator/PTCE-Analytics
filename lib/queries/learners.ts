import { supabase } from "@/lib/supabase";
import type { Learner, Participation, Activity } from "@/lib/database.types";

export interface LearnerSummary {
  id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
  employer_normalized: string | null;
  practice_setting: string | null;
  activity_count: number;
  avg_score_change: number | null;
}

export async function getLearnersList(search?: string): Promise<LearnerSummary[]> {
  const { data: learners } = await supabase.from("learners").select("*").order("email");
  if (!learners) return [];

  const { data: parts } = await supabase.from("participations").select("learner_id, score_change");

  const statsMap = new Map<number, { count: number; total: number; n: number }>();
  for (const p of parts ?? []) {
    const entry = statsMap.get(p.learner_id) ?? { count: 0, total: 0, n: 0 };
    entry.count++;
    if (p.score_change != null) { entry.total += p.score_change; entry.n++; }
    statsMap.set(p.learner_id, entry);
  }

  let results: LearnerSummary[] = learners.map((l) => {
    const s = statsMap.get(l.id);
    return {
      id: l.id,
      email: l.email,
      first_name: l.first_name,
      last_name: l.last_name,
      employer_normalized: l.employer_normalized,
      practice_setting: l.practice_setting,
      activity_count: s?.count ?? 0,
      avg_score_change: s && s.n > 0 ? Math.round((s.total / s.n) * 10) / 10 : null,
    };
  });

  if (search) {
    const q = search.toLowerCase();
    results = results.filter(
      (l) =>
        l.email.toLowerCase().includes(q) ||
        (l.first_name?.toLowerCase().includes(q)) ||
        (l.last_name?.toLowerCase().includes(q))
    );
  }

  return results;
}

export interface LearnerProfile extends Learner {
  participations: (Participation & { activity_name: string; activity_type: string | null })[];
}

export async function getLearnerProfile(learnerId: number): Promise<LearnerProfile | null> {
  const { data: learner } = await supabase.from("learners").select("*").eq("id", learnerId).single();
  if (!learner) return null;

  const { data: parts } = await supabase
    .from("participations")
    .select("*")
    .eq("learner_id", learnerId)
    .order("participation_date");

  const { data: activities } = await supabase.from("activities").select("activity_id, activity_name, activity_type");
  const actMap = new Map((activities ?? []).map((a) => [a.activity_id, a]));

  return {
    ...learner,
    participations: (parts ?? []).map((p) => ({
      ...p,
      activity_name: actMap.get(p.activity_id)?.activity_name ?? p.activity_id,
      activity_type: actMap.get(p.activity_id)?.activity_type ?? null,
    })),
  };
}
