"use server";

import { getServiceClient } from "@/lib/supabase";

export interface DashboardChartData {
  scoreChanges: number[];
  confChanges: number[];
  yearlyData: { year: string; avg_change: number }[];
  employerData: { employer: string; avg_change: number }[];
}

export async function getDashboardChartData(): Promise<DashboardChartData> {
  const supabase = getServiceClient();
  const { data: parts } = await supabase.from("participations").select("score_change, confidence_change, participation_date, learner_id");
  const { data: learners } = await supabase.from("learners").select("id, employer_normalized");

  const scoreChanges: number[] = [];
  const confChanges: number[] = [];
  const byYear = new Map<string, number[]>();
  const empMap = new Map<number, string>();
  const byEmp = new Map<string, number[]>();

  if (parts) {
    for (const p of parts) {
      if (p.score_change != null) scoreChanges.push(p.score_change);
      if (p.confidence_change != null) confChanges.push(p.confidence_change);

      const year = p.participation_date?.slice(0, 4) ?? "Unknown";
      if (!byYear.has(year)) byYear.set(year, []);
      if (p.score_change != null) byYear.get(year)!.push(p.score_change);
    }

    if (learners) {
      for (const l of learners) {
        if (l.employer_normalized) empMap.set(l.id, l.employer_normalized);
      }
      for (const p of parts) {
        const emp = empMap.get(p.learner_id);
        if (emp && p.score_change != null) {
          if (!byEmp.has(emp)) byEmp.set(emp, []);
          byEmp.get(emp)!.push(p.score_change);
        }
      }
    }
  }

  const yearlyData = Array.from(byYear.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([year, vals]) => ({
      year,
      avg_change: Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10,
    }));

  const employerData = Array.from(byEmp.entries())
    .map(([employer, vals]) => ({
      employer,
      avg_change: Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10,
    }))
    .sort((a, b) => b.avg_change - a.avg_change)
    .slice(0, 10);

  return { scoreChanges, confChanges, yearlyData, employerData };
}
