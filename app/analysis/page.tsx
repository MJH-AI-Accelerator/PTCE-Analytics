"use client";

import { useEffect, useState } from "react";
import { questionLevelAnalysis, categoryLevelAnalysis, type QuestionStats } from "@/lib/analytics/questions";
import { evaluationAnalysis, intendedChangesSummary, barriersSummary, type EvalSummary } from "@/lib/analytics/evaluation";
import { getActivityList } from "@/lib/queries/catalog";
import BarChart from "@/components/charts/BarChart";

type Section = "questions" | "evaluation";
type QuestionTab = "questions" | "categories" | "confidence";
type EvalTab = "practice" | "changes" | "barriers" | "all";

export default function AnalysisPage() {
  const [section, setSection] = useState<Section>("questions");

  // Question state
  const [questionTab, setQuestionTab] = useState<QuestionTab>("questions");
  const [questions, setQuestions] = useState<QuestionStats[]>([]);
  const [categories, setCategories] = useState<{ category: string; avg_pre: number | null; avg_post: number | null; change: number | null }[]>([]);
  const [activities, setActivities] = useState<{ activity_id: string; activity_name: string }[]>([]);
  const [selectedActivity, setSelectedActivity] = useState("");

  // Evaluation state
  const [evalTab, setEvalTab] = useState<EvalTab>("practice");
  const [evalData, setEvalData] = useState<EvalSummary[]>([]);
  const [changes, setChanges] = useState<{ change: string; count: number }[]>([]);
  const [barriers, setBarriers] = useState<{ barrier: string; count: number }[]>([]);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getActivityList().then((data) => setActivities(data));
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      questionLevelAnalysis(selectedActivity || undefined),
      categoryLevelAnalysis(),
      evaluationAnalysis(),
      intendedChangesSummary(),
      barriersSummary(),
    ]).then(([q, c, e, ch, b]) => {
      setQuestions(q);
      setCategories(c);
      setEvalData(e);
      setChanges(ch);
      setBarriers(b);
      setLoading(false);
    });
  }, [selectedActivity]);

  const assessmentQs = questions.filter((q) => q.question_type === "assessment");
  const confidenceQs = questions.filter((q) => q.question_type === "confidence");
  const practiceData = evalData.filter((e) => e.category === "practice_profile");

  const sections = [
    { id: "questions" as Section, label: "Question Analysis" },
    { id: "evaluation" as Section, label: "Evaluation Analysis" },
  ];

  const questionTabs = [
    { id: "questions" as QuestionTab, label: "Per-Question" },
    { id: "categories" as QuestionTab, label: "By Category" },
    { id: "confidence" as QuestionTab, label: "Confidence Questions" },
  ];

  const evalTabs = [
    { id: "practice" as EvalTab, label: "Practice Profile" },
    { id: "changes" as EvalTab, label: "Intended Changes" },
    { id: "barriers" as EvalTab, label: "Barriers" },
    { id: "all" as EvalTab, label: "All Responses" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Analysis</h1>

      {/* Section toggle */}
      <div className="flex gap-1 mb-6 border-b">
        {sections.map((s) => (
          <button key={s.id} onClick={() => setSection(s.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${section === s.id ? "border-teal-500 text-teal-600" : "border-transparent text-navy-400 hover:text-navy-600"}`}
          >{s.label}</button>
        ))}
      </div>

      {loading ? <p className="text-navy-400">Loading...</p> : (
        <>
          {/* QUESTION ANALYSIS */}
          {section === "questions" && (
            <div>
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
                {questionTabs.map((t) => (
                  <button key={t.id} onClick={() => setQuestionTab(t.id)}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${questionTab === t.id ? "border-teal-500 text-teal-600" : "border-transparent text-navy-400 hover:text-navy-600"}`}
                  >{t.label}</button>
                ))}
              </div>

              {questionTab === "questions" && (
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

              {questionTab === "categories" && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                  {categories.length === 0 ? <p className="text-navy-400">No category data.</p> : (
                    <>
                      <BarChart
                        data={categories}
                        xKey="category"
                        yKeys={[
                          { key: "avg_pre", color: "#8B99B1", label: "Avg Pre %" },
                          { key: "avg_post", color: "#00B4A6", label: "Avg Post %" },
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

              {questionTab === "confidence" && (
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
            </div>
          )}

          {/* EVALUATION ANALYSIS */}
          {section === "evaluation" && (
            <div>
              <div className="flex gap-1 mb-6 border-b">
                {evalTabs.map((t) => (
                  <button key={t.id} onClick={() => setEvalTab(t.id)}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${evalTab === t.id ? "border-teal-500 text-teal-600" : "border-transparent text-navy-400 hover:text-navy-600"}`}
                  >{t.label}</button>
                ))}
              </div>

              {evalTab === "practice" && (
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

              {evalTab === "changes" && (
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

              {evalTab === "barriers" && (
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

              {evalTab === "all" && (
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
          )}
        </>
      )}
    </div>
  );
}
