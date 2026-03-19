import { supabase } from "@/lib/supabase";

export interface YearlyStats {
  year: string;
  participants: number;
  avg_pre_score: number | null;
  avg_post_score: number | null;
  avg_score_change: number | null;
  avg_confidence_change: number | null;
}

export async function yearlyComparison(): Promise<YearlyStats[]> {
  const { data: parts } = await supabase.from("participations").select("participation_date, pre_score, post_score, score_change, confidence_change");
  if (!parts) return [];

  const grouped = new Map<string, { pre: number[]; post: number[]; change: number[]; conf: number[]; count: number }>();
  for (const p of parts) {
    const year = p.participation_date?.slice(0, 4) ?? "Unknown";
    if (!grouped.has(year)) grouped.set(year, { pre: [], post: [], change: [], conf: [], count: 0 });
    const g = grouped.get(year)!;
    g.count++;
    if (p.pre_score != null) g.pre.push(p.pre_score);
    if (p.post_score != null) g.post.push(p.post_score);
    if (p.score_change != null) g.change.push(p.score_change);
    if (p.confidence_change != null) g.conf.push(p.confidence_change);
  }

  const avg = (arr: number[]) => arr.length > 0 ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : null;

  return Array.from(grouped.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([year, g]) => ({
      year,
      participants: g.count,
      avg_pre_score: avg(g.pre),
      avg_post_score: avg(g.post),
      avg_score_change: avg(g.change),
      avg_confidence_change: avg(g.conf),
    }));
}

export interface MonthlyPoint {
  month: string;
  value: number;
}

export async function monthlyTrend(metric = "score_change"): Promise<MonthlyPoint[]> {
  const { data: parts } = await supabase.from("participations").select("participation_date, score_change, confidence_change");
  if (!parts) return [];

  const grouped = new Map<string, number[]>();
  for (const p of parts) {
    const month = p.participation_date?.slice(0, 7) ?? "Unknown";
    if (!grouped.has(month)) grouped.set(month, []);
    const val = metric === "confidence_change" ? p.confidence_change : p.score_change;
    if (val != null) grouped.get(month)!.push(val);
  }

  return Array.from(grouped.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, vals]) => ({
      month,
      value: Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10,
    }));
}
