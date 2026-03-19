"use client";

import { useEffect, useState } from "react";
import { questionLevelAnalysis, categoryLevelAnalysis, type QuestionStats } from "@/lib/analytics/questions";
import { supabase } from "@/lib/supabase";
import BarChart from "@/components/charts/BarChart";

type Tab = "questions" | "categories" | "confidence";

export default function QuestionAnalysis() {
  const [tab, setTab] = useState<Tab>("questions");
  const [questions, setQuestions] = useState<QuestionStats[]>([]);
  const [categories, setCategories] = useState<{ category: string; avg_pre: number | null; avg_post: number | null; change: number | null }[]>([]);
  const [activities, setActivities] = useState<{ activity_id: string; activity_name: string }[]>([]);
  const [selectedActivity, setSelectedActivity] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("activities").select("activity_id, activity_name").then(({ data }) => setActivities(data ?? []));
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      questionLevelAnalysis(selectedActivity || undefined),
      categoryLevelAnalysis(),
    ]).then(([q, c]) => { setQuestions(q); setCategories(c); setLoading(false); });
  }, [selectedActivity]);

  const assessmentQs = questions.filter((q) => q.question_type === "assessment");
  const confidenceQs = questions.filter((q) => q.question_type === "confidence");

  const tabs = [
    { id: "questions" as Tab, label: "Per-Question" },
    { id: "categories" as Tab, label: "By Category" },
    { id: "confidence" as Tab, label: "Confidence Questions" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Question Analysis</h1>

      <div className="flex flex-wrap gap-4 mb-6 items-end">
        <div>
          <label className="block text-sm font-medium text-navy-600 mb-1">Activity</label>
          <select value={selectedActivity} onChange={(e) => setSelectedActivity(e.target.value)} className="border rounded-lg px-3 py-2 text-sm bg-white min-w-[200px]">
            <option value="">All Activities</option>
            {activities.map((a) => <option key={a.activity_id} value={a.activity_id}>{a.activity_name}</option>)}
          </select>
        </div>
      </div>

      <div className="flex gap-1 mb-6 border-b">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t.id ? "border-teal-500 text-teal-600" : "border-transparent text-navy-400 hover:text-navy-600"}`}
          >{t.label}</button>
        ))}
      </div>

      {loading ? <p className="text-navy-400">Loading...</p> : (
        <>
          {tab === "questions" && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
              {assessmentQs.length === 0 ? <p className="p-6 text-navy-400">No assessment questions found.</p> : (
                <table className="min-w-full text-sm">
                  <thead className="bg-navy-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-navy-500 max-w-md">Question</th>
                      <th className="px-4 py-3 text-left font-medium text-navy-500">Category</th>
                      <th className="px-4 py-3 text-left font-medium text-navy-500">Pre %</th>
                      <th className="px-4 py-3 text-left font-medium text-navy-500">Post %</th>
                      <th className="px-4 py-3 text-left font-medium text-navy-500">Change</th>
                      <th className="px-4 py-3 text-left font-medium text-navy-500">N</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assessmentQs.map((q, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-4 py-3 max-w-md truncate">{q.question_text}</td>
                        <td className="px-4 py-3">{q.category ?? "—"}</td>
                        <td className="px-4 py-3">{q.pre_correct_pct != null ? `${q.pre_correct_pct}%` : "—"}</td>
                        <td className="px-4 py-3">{q.post_correct_pct != null ? `${q.post_correct_pct}%` : "—"}</td>
                        <td className={`px-4 py-3 ${(q.change ?? 0) > 0 ? "text-teal-600 font-medium" : ""}`}>
                          {q.change != null ? `${q.change > 0 ? "+" : ""}${q.change}%` : "—"}
                        </td>
                        <td className="px-4 py-3">{q.n_responses}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {tab === "categories" && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              {categories.length === 0 ? <p className="text-navy-400">No category data.</p> : (
                <>
                  <BarChart
                    data={categories}
                    xKey="category"
                    yKeys={[
                      { key: "avg_pre", color: "#94a3b8", label: "Avg Pre %" },
                      { key: "avg_post", color: "#3b82f6", label: "Avg Post %" },
                    ]}
                    title="Correct % by Category"
                    height={300}
                  />
                  <table className="min-w-full text-sm mt-4">
                    <thead className="bg-navy-50">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium text-navy-500">Category</th>
                        <th className="px-4 py-2 text-left font-medium text-navy-500">Avg Pre %</th>
                        <th className="px-4 py-2 text-left font-medium text-navy-500">Avg Post %</th>
                        <th className="px-4 py-2 text-left font-medium text-navy-500">Change</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categories.map((c) => (
                        <tr key={c.category} className="border-t">
                          <td className="px-4 py-2 font-medium">{c.category}</td>
                          <td className="px-4 py-2">{c.avg_pre ?? "—"}%</td>
                          <td className="px-4 py-2">{c.avg_post ?? "—"}%</td>
                          <td className={`px-4 py-2 ${(c.change ?? 0) > 0 ? "text-teal-600 font-medium" : ""}`}>
                            {c.change != null ? `${c.change > 0 ? "+" : ""}${c.change}%` : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          )}

          {tab === "confidence" && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
              {confidenceQs.length === 0 ? <p className="p-6 text-navy-400">No confidence questions found.</p> : (
                <table className="min-w-full text-sm">
                  <thead className="bg-navy-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-navy-500 max-w-md">Question</th>
                      <th className="px-4 py-3 text-left font-medium text-navy-500">N</th>
                    </tr>
                  </thead>
                  <tbody>
                    {confidenceQs.map((q, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-4 py-3 max-w-md truncate">{q.question_text}</td>
                        <td className="px-4 py-3">{q.n_responses}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
