"use client";

import { useEffect, useState } from "react";
import { employerPerformance, type EmployerStats } from "@/lib/analytics/employer";
import BarChart from "@/components/charts/BarChart";

export default function EmployerAnalysis() {
  const [data, setData] = useState<EmployerStats[]>([]);
  const [minLearners, setMinLearners] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    employerPerformance(minLearners).then((d) => { setData(d); setLoading(false); });
  }, [minLearners]);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Employer Analysis</h1>

      <div className="mb-6 flex items-center gap-4">
        <label className="text-sm font-medium text-navy-600">Min Learners:</label>
        <input
          type="range"
          min={1}
          max={50}
          value={minLearners}
          onChange={(e) => { setMinLearners(Number(e.target.value)); setLoading(true); }}
          className="w-48"
        />
        <span className="text-sm text-navy-500">{minLearners}</span>
      </div>

      {loading ? <p className="text-navy-400">Loading...</p> : (
        <>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
            <BarChart
              data={data.slice(0, 15)}
              xKey="employer"
              yKeys={[{ key: "avg_score_change", color: "#3b82f6", label: "Avg Score Change" }]}
              title="Top Employers by Score Change"
              height={350}
            />
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
            {data.length === 0 ? <p className="p-6 text-navy-400">No employer data available.</p> : (
              <table className="min-w-full text-sm">
                <thead className="bg-navy-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-navy-500">Employer</th>
                    <th className="px-4 py-3 text-left font-medium text-navy-500">Learners</th>
                    <th className="px-4 py-3 text-left font-medium text-navy-500">Avg Pre</th>
                    <th className="px-4 py-3 text-left font-medium text-navy-500">Avg Post</th>
                    <th className="px-4 py-3 text-left font-medium text-navy-500">Avg Change</th>
                    <th className="px-4 py-3 text-left font-medium text-navy-500">Conf Change</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((d) => (
                    <tr key={d.employer} className="border-t hover:bg-navy-50">
                      <td className="px-4 py-3 font-medium">{d.employer}</td>
                      <td className="px-4 py-3">{d.learner_count}</td>
                      <td className="px-4 py-3">{d.avg_pre_score ?? "—"}</td>
                      <td className="px-4 py-3">{d.avg_post_score ?? "—"}</td>
                      <td className={`px-4 py-3 font-medium ${(d.avg_score_change ?? 0) > 0 ? "text-teal-600" : ""}`}>
                        {d.avg_score_change != null ? `${d.avg_score_change > 0 ? "+" : ""}${d.avg_score_change}%` : "—"}
                      </td>
                      <td className="px-4 py-3">{d.avg_confidence_change ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
