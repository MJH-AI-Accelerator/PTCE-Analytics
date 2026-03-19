"use client";

import { useEffect, useState } from "react";
import { yearlyComparison, monthlyTrend, type YearlyStats, type MonthlyPoint } from "@/lib/analytics/temporal";
import BarChart from "@/components/charts/BarChart";
import LineChart from "@/components/charts/LineChart";

export default function TemporalAnalysis() {
  const [yearly, setYearly] = useState<YearlyStats[]>([]);
  const [monthly, setMonthly] = useState<MonthlyPoint[]>([]);
  const [metric, setMetric] = useState("score_change");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([yearlyComparison(), monthlyTrend(metric)]).then(([y, m]) => {
      setYearly(y);
      setMonthly(m);
      setLoading(false);
    });
  }, [metric]);

  if (loading) return <div><h1 className="text-2xl font-bold mb-6">Temporal Analysis</h1><p className="text-navy-400">Loading...</p></div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Temporal Analysis</h1>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Year-over-Year Comparison</h2>
        {yearly.length === 0 ? <p className="text-navy-400">No data available.</p> : (
          <>
            <BarChart
              data={yearly}
              xKey="year"
              yKeys={[
                { key: "avg_pre_score", color: "#94a3b8", label: "Avg Pre" },
                { key: "avg_post_score", color: "#3b82f6", label: "Avg Post" },
              ]}
              title="Pre vs Post Scores by Year"
              height={300}
            />
            <table className="min-w-full text-sm mt-4">
              <thead className="bg-navy-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-navy-500">Year</th>
                  <th className="px-4 py-2 text-left font-medium text-navy-500">Participants</th>
                  <th className="px-4 py-2 text-left font-medium text-navy-500">Avg Pre</th>
                  <th className="px-4 py-2 text-left font-medium text-navy-500">Avg Post</th>
                  <th className="px-4 py-2 text-left font-medium text-navy-500">Avg Change</th>
                </tr>
              </thead>
              <tbody>
                {yearly.map((y) => (
                  <tr key={y.year} className="border-t">
                    <td className="px-4 py-2 font-medium">{y.year}</td>
                    <td className="px-4 py-2">{y.participants}</td>
                    <td className="px-4 py-2">{y.avg_pre_score ?? "—"}</td>
                    <td className="px-4 py-2">{y.avg_post_score ?? "—"}</td>
                    <td className={`px-4 py-2 ${(y.avg_score_change ?? 0) > 0 ? "text-teal-600 font-medium" : ""}`}>
                      {y.avg_score_change != null ? `${y.avg_score_change > 0 ? "+" : ""}${y.avg_score_change}%` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Monthly Trends</h2>
          <select value={metric} onChange={(e) => setMetric(e.target.value)} className="border rounded px-3 py-1 text-sm">
            <option value="score_change">Score Change</option>
            <option value="confidence_change">Confidence Change</option>
          </select>
        </div>
        <LineChart
          data={monthly}
          xKey="month"
          yKeys={[{ key: "value", color: "#3b82f6", label: metric === "score_change" ? "Avg Score Change" : "Avg Confidence Change" }]}
          height={300}
        />
      </div>
    </div>
  );
}
