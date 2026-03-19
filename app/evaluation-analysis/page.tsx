"use client";

import { useEffect, useState } from "react";
import { evaluationAnalysis, intendedChangesSummary, barriersSummary, type EvalSummary } from "@/lib/analytics/evaluation";

type Tab = "practice" | "changes" | "barriers" | "all";

export default function EvaluationAnalysisPage() {
  const [tab, setTab] = useState<Tab>("practice");
  const [evalData, setEvalData] = useState<EvalSummary[]>([]);
  const [changes, setChanges] = useState<{ change: string; count: number }[]>([]);
  const [barriers, setBarriers] = useState<{ barrier: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([evaluationAnalysis(), intendedChangesSummary(), barriersSummary()]).then(([e, c, b]) => {
      setEvalData(e);
      setChanges(c);
      setBarriers(b);
      setLoading(false);
    });
  }, []);

  const practiceData = evalData.filter((e) => e.category === "practice_profile");
  const tabs = [
    { id: "practice" as Tab, label: "Practice Profile" },
    { id: "changes" as Tab, label: "Intended Changes" },
    { id: "barriers" as Tab, label: "Barriers" },
    { id: "all" as Tab, label: "All Responses" },
  ];

  if (loading) return <div><h1 className="text-2xl font-bold mb-6">Evaluation Analysis</h1><p className="text-navy-400">Loading...</p></div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Evaluation Analysis</h1>

      <div className="flex gap-1 mb-6 border-b">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t.id ? "border-teal-500 text-teal-600" : "border-transparent text-navy-400 hover:text-navy-600"}`}
          >{t.label}</button>
        ))}
      </div>

      {tab === "practice" && (
        <div className="space-y-4">
          {practiceData.length === 0 ? <p className="text-navy-400">No practice profile data.</p> : (
            practiceData.map((e, i) => (
              <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <h3 className="font-medium mb-2">{e.question_text}</h3>
                <div className="space-y-1">
                  {e.responses.map((r) => (
                    <div key={r.value} className="flex items-center gap-2">
                      <div className="w-48 text-sm text-navy-500 truncate">{r.value}</div>
                      <div className="flex-1 bg-gray-100 rounded-full h-4">
                        <div className="bg-teal-500 rounded-full h-4" style={{ width: `${(r.count / e.total) * 100}%` }} />
                      </div>
                      <span className="text-sm text-navy-400 w-16 text-right">{r.count} ({Math.round((r.count / e.total) * 100)}%)</span>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "changes" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          {changes.length === 0 ? <p className="text-navy-400">No intended changes data.</p> : (
            <div className="space-y-2">
              {changes.map((c) => (
                <div key={c.change} className="flex items-center gap-3">
                  <span className="text-sm flex-1">{c.change}</span>
                  <span className="text-sm font-medium text-navy-600 bg-navy-50 px-2 py-0.5 rounded">{c.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "barriers" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          {barriers.length === 0 ? <p className="text-navy-400">No barriers data.</p> : (
            <div className="space-y-2">
              {barriers.map((b) => (
                <div key={b.barrier} className="flex items-center gap-3">
                  <span className="text-sm flex-1">{b.barrier}</span>
                  <span className="text-sm font-medium text-navy-600 bg-navy-50 px-2 py-0.5 rounded">{b.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "all" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
          {evalData.length === 0 ? <p className="p-6 text-navy-400">No evaluation data.</p> : (
            <table className="min-w-full text-sm">
              <thead className="bg-navy-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-navy-500">Question</th>
                  <th className="px-4 py-3 text-left font-medium text-navy-500">Category</th>
                  <th className="px-4 py-3 text-left font-medium text-navy-500">Responses</th>
                </tr>
              </thead>
              <tbody>
                {evalData.map((e, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-4 py-3">{e.question_text}</td>
                    <td className="px-4 py-3">{e.category ?? "—"}</td>
                    <td className="px-4 py-3">{e.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
