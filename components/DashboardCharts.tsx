"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Histogram from "@/components/charts/Histogram";
import BarChart from "@/components/charts/BarChart";

export default function DashboardCharts() {
  const [scoreChanges, setScoreChanges] = useState<number[]>([]);
  const [confChanges, setConfChanges] = useState<number[]>([]);
  const [yearlyData, setYearlyData] = useState<Record<string, unknown>[]>([]);
  const [employerData, setEmployerData] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: parts } = await supabase.from("participations").select("score_change, confidence_change, participation_date, learner_id");
      const { data: learners } = await supabase.from("learners").select("id, employer_normalized");

      if (parts) {
        setScoreChanges(parts.filter((p) => p.score_change != null).map((p) => p.score_change!));
        setConfChanges(parts.filter((p) => p.confidence_change != null).map((p) => p.confidence_change!));

        // Yearly
        const byYear = new Map<string, number[]>();
        for (const p of parts) {
          const year = p.participation_date?.slice(0, 4) ?? "Unknown";
          if (!byYear.has(year)) byYear.set(year, []);
          if (p.score_change != null) byYear.get(year)!.push(p.score_change);
        }
        setYearlyData(
          Array.from(byYear.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([year, vals]) => ({
              year,
              avg_change: Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10,
            }))
        );

        // Employer top 10
        if (learners) {
          const empMap = new Map<number, string>();
          for (const l of learners) if (l.employer_normalized) empMap.set(l.id, l.employer_normalized);

          const byEmp = new Map<string, number[]>();
          for (const p of parts) {
            const emp = empMap.get(p.learner_id);
            if (emp && p.score_change != null) {
              if (!byEmp.has(emp)) byEmp.set(emp, []);
              byEmp.get(emp)!.push(p.score_change);
            }
          }

          setEmployerData(
            Array.from(byEmp.entries())
              .map(([employer, vals]) => ({
                employer,
                avg_change: Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10,
              }))
              .sort((a, b) => (b.avg_change as number) - (a.avg_change as number))
              .slice(0, 10)
          );
        }
      }
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return null;
  if (scoreChanges.length === 0 && confChanges.length === 0) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
      <div className="card">
        <Histogram data={scoreChanges} title="Score Change Distribution" color="#00B4A6" />
      </div>
      <div className="card">
        <Histogram data={confChanges} title="Confidence Change Distribution" color="#F7941D" />
      </div>
      <div className="card">
        <BarChart data={yearlyData} xKey="year" yKeys={[{ key: "avg_change", color: "#1B2A4A", label: "Avg Score Change" }]} title="Year-over-Year" />
      </div>
      <div className="card">
        <BarChart data={employerData} xKey="employer" yKeys={[{ key: "avg_change", color: "#00B4A6", label: "Avg Score Change" }]} title="Top 10 Employers" />
      </div>
    </div>
  );
}
