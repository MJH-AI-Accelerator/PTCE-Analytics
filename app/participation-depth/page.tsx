"use client";

import { useEffect, useState } from "react";
import { participationDepth, practiceSettingBreakdown, type DepthSegment, type SettingBreakdown } from "@/lib/analytics/participation";
import BarChart from "@/components/charts/BarChart";

export default function ParticipationDepthPage() {
  const [segments, setSegments] = useState<DepthSegment[]>([]);
  const [settings, setSettings] = useState<SettingBreakdown[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([participationDepth(), practiceSettingBreakdown()]).then(([s, ps]) => {
      setSegments(s);
      setSettings(ps);
      setLoading(false);
    });
  }, []);

  if (loading) return <div><h1 className="text-2xl font-bold mb-6">Participation Depth</h1><p className="text-navy-400">Loading...</p></div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Participation Depth</h1>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Depth Segments</h2>
        {segments.length === 0 ? <p className="text-navy-400">No data available.</p> : (
          <>
            <BarChart
              data={segments}
              xKey="segment"
              yKeys={[
                { key: "avg_pre_score", color: "#94a3b8", label: "Avg Pre" },
                { key: "avg_post_score", color: "#3b82f6", label: "Avg Post" },
              ]}
              title="Scores by Participation Depth"
              height={300}
            />
            <table className="min-w-full text-sm mt-4">
              <thead className="bg-navy-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-navy-500">Segment</th>
                  <th className="px-4 py-2 text-left font-medium text-navy-500">Learners</th>
                  <th className="px-4 py-2 text-left font-medium text-navy-500">Avg Pre</th>
                  <th className="px-4 py-2 text-left font-medium text-navy-500">Avg Post</th>
                  <th className="px-4 py-2 text-left font-medium text-navy-500">Avg Change</th>
                </tr>
              </thead>
              <tbody>
                {segments.map((s) => (
                  <tr key={s.segment} className="border-t">
                    <td className="px-4 py-2 font-medium">{s.segment}</td>
                    <td className="px-4 py-2">{s.learner_count}</td>
                    <td className="px-4 py-2">{s.avg_pre_score ?? "—"}</td>
                    <td className="px-4 py-2">{s.avg_post_score ?? "—"}</td>
                    <td className={`px-4 py-2 ${(s.avg_score_change ?? 0) > 0 ? "text-teal-600 font-medium" : ""}`}>
                      {s.avg_score_change != null ? `${s.avg_score_change > 0 ? "+" : ""}${s.avg_score_change}%` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold mb-4">Practice Setting Breakdown</h2>
        {settings.length === 0 ? <p className="text-navy-400">No data available.</p> : (
          <table className="min-w-full text-sm">
            <thead className="bg-navy-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-navy-500">Setting</th>
                <th className="px-4 py-2 text-left font-medium text-navy-500">Participations</th>
                <th className="px-4 py-2 text-left font-medium text-navy-500">Avg Change</th>
              </tr>
            </thead>
            <tbody>
              {settings.map((s) => (
                <tr key={s.setting} className="border-t">
                  <td className="px-4 py-2 font-medium">{s.setting}</td>
                  <td className="px-4 py-2">{s.count}</td>
                  <td className={`px-4 py-2 ${(s.avg_score_change ?? 0) > 0 ? "text-teal-600 font-medium" : ""}`}>
                    {s.avg_score_change != null ? `${s.avg_score_change > 0 ? "+" : ""}${s.avg_score_change}%` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
