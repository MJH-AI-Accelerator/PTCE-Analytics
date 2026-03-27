"use server";

import { supabaseAdmin } from "@/lib/supabase-server";
import type { Activity, Question, LearningObjective } from "@/lib/database.types";
import Fuse from "fuse.js";

export interface CatalogEntry extends Activity {
  learner_count: number;
  avg_score_change: number | null;
}

export async function getActivityCatalog(search?: string): Promise<CatalogEntry[]> {
  const supabase = supabaseAdmin;
  const { data: activities } = await supabase.from("activities").select("*").order("activity_date", { ascending: false });
  if (!activities) return [];

  const { data: stats } = await supabase
    .from("participations")
    .select("activity_id, score_change");

  const statsMap = new Map<string, { count: number; totalChange: number; changeCount: number }>();
  for (const s of stats ?? []) {
    const entry = statsMap.get(s.activity_id) ?? { count: 0, totalChange: 0, changeCount: 0 };
    entry.count++;
    if (s.score_change != null) {
      entry.totalChange += s.score_change;
      entry.changeCount++;
    }
    statsMap.set(s.activity_id, entry);
  }

  let results: CatalogEntry[] = activities.map((a) => {
    const s = statsMap.get(a.activity_id);
    return {
      ...a,
      learner_count: s?.count ?? 0,
      avg_score_change: s && s.changeCount > 0 ? Math.round((s.totalChange / s.changeCount) * 10) / 10 : null,
    };
  });

  if (search) {
    const fuse = new Fuse(results, { keys: ["activity_name", "activity_id"], threshold: 0.3 });
    results = fuse.search(search).map((r) => r.item);
  }

  return results;
}

export interface ActivityDetail extends Activity {
  objectives: LearningObjective[];
  questions: Question[];
  learner_count: number;
  avg_pre_score: number | null;
  avg_post_score: number | null;
  avg_score_change: number | null;
}

export async function getActivityDetail(activityId: string): Promise<ActivityDetail | null> {
  const supabase = supabaseAdmin;
  const { data: activity } = await supabase.from("activities").select("*").eq("activity_id", activityId).single();
  if (!activity) return null;

  const [{ data: objectives }, { data: questions }, { data: parts }] = await Promise.all([
    supabase.from("learning_objectives").select("*").eq("activity_id", activityId),
    supabase.from("questions").select("*").eq("activity_id", activityId).order("question_number"),
    supabase.from("participations").select("pre_score, post_score, score_change").eq("activity_id", activityId),
  ]);

  const p = parts ?? [];
  const avg = (arr: (number | null)[]) => {
    const valid = arr.filter((v): v is number => v != null);
    return valid.length > 0 ? Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 10) / 10 : null;
  };

  return {
    ...activity,
    objectives: objectives ?? [],
    questions: questions ?? [],
    learner_count: p.length,
    avg_pre_score: avg(p.map((x) => x.pre_score)),
    avg_post_score: avg(p.map((x) => x.post_score)),
    avg_score_change: avg(p.map((x) => x.score_change)),
  };
}

export interface QuestionSearchResult {
  question_text: string;
  question_type: string;
  question_category: string | null;
  activity_id: string;
  activity_name: string;
}

export async function searchQuestions(query: string): Promise<QuestionSearchResult[]> {
  const supabase = supabaseAdmin;
  const { data: questions } = await supabase.from("questions").select("question_text, question_type, question_category, activity_id");
  if (!questions || !query) return [];

  const { data: activities } = await supabase.from("activities").select("activity_id, activity_name");
  const actMap = new Map((activities ?? []).map((a) => [a.activity_id, a.activity_name]));

  const fuse = new Fuse(questions, { keys: ["question_text"], threshold: 0.4, includeScore: true });
  return fuse.search(query).map((r) => ({
    ...r.item,
    activity_name: actMap.get(r.item.activity_id) ?? r.item.activity_id,
  }));
}

export interface IdenticalQuestionGroup {
  question_text: string;
  activities: { activity_id: string; activity_name: string }[];
}

export async function findIdenticalQuestions(): Promise<IdenticalQuestionGroup[]> {
  const supabase = supabaseAdmin;
  const { data: questions } = await supabase.from("questions").select("question_text, activity_id");
  if (!questions) return [];

  const { data: activities } = await supabase.from("activities").select("activity_id, activity_name");
  const actMap = new Map((activities ?? []).map((a) => [a.activity_id, a.activity_name]));

  const grouped = new Map<string, Set<string>>();
  for (const q of questions) {
    const text = q.question_text.trim().toLowerCase();
    if (!grouped.has(text)) grouped.set(text, new Set());
    grouped.get(text)!.add(q.activity_id);
  }

  return Array.from(grouped.entries())
    .filter(([, ids]) => ids.size > 1)
    .map(([text, ids]) => ({
      question_text: text,
      activities: Array.from(ids).map((id) => ({ activity_id: id, activity_name: actMap.get(id) ?? id })),
    }));
}

export async function getActivityList(): Promise<{ activity_id: string; activity_name: string }[]> {
  const supabase = supabaseAdmin;
  const { data } = await supabase.from("activities").select("activity_id, activity_name");
  return data ?? [];
}
