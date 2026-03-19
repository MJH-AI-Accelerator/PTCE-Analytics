"use client";

import { useEffect, useState, useRef } from "react";
import { getUnifiedResponses, type UnifiedRow } from "@/lib/queries/responses";
import { supabase } from "@/lib/supabase";
import ColumnGroupToggle from "@/components/ColumnGroupToggle";
import { ChevronDown, Building2, CalendarRange, FlaskConical, Layers } from "lucide-react";

// Analytics imports
import { employerPerformance, type EmployerStats } from "@/lib/analytics/employer";
import { yearlyComparison, monthlyTrend, type YearlyStats, type MonthlyPoint } from "@/lib/analytics/temporal";
import { descriptiveStats, pairedTTest, type DescriptiveResult, type TTestResult } from "@/lib/analytics/statistics";
import { participationDepth, practiceSettingBreakdown, type DepthSegment, type SettingBreakdown } from "@/lib/analytics/participation";
import BarChart from "@/components/charts/BarChart";
import LineChart from "@/components/charts/LineChart";

const COLUMN_GROUPS = [
  { id: "demo", label: "Demographics", cols: ["learner_name", "email", "employer"] },
  { id: "scores", label: "Scores", cols: ["pre_score", "post_score", "score_change"] },
  { id: "confidence", label: "Confidence", cols: ["pre_confidence", "post_confidence", "confidence_change"] },
];

type AnalysisView = null | "employer" | "temporal" | "statistics" | "depth";

export default function LearnerResponses() {
  const [rows, setRows] = useState<UnifiedRow[]>([]);
  const [activities, setActivities] = useState<{ activity_id: string; activity_name: string }[]>([]);
  const [selectedActivity, setSelectedActivity] = useState("");
  const [activeGroups, setActiveGroups] = useState(new Set(COLUMN_GROUPS.map((g) => g.id)));
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  // Analytics state
  const [analysisView, setAnalysisView] = useState<AnalysisView>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Employer
  const [employerData, setEmployerData] = useState<EmployerStats[]>([]);
  const [minLearners, setMinLearners] = useState(1);
  // Temporal
  const [yearly, setYearly] = useState<YearlyStats[]>([]);
  const [monthly, setMonthly] = useState<MonthlyPoint[]>([]);
  const [metric, setMetric] = useState("score_change");
  // Statistics
  const [desc, setDesc] = useState<DescriptiveResult[]>([]);
  const [ttest, setTtest] = useState<TTestResult | null>(null);
  // Depth
  const [segments, setSegments] = useState<DepthSegment[]>([]);
  const [settings, setSettings] = useState<SettingBreakdown[]>([]);

  const [analysisLoading, setAnalysisLoading] = useState(false);

  useEffect(() => {
    supabase.from("activities").select("activity_id, activity_name").then(({ data }) => setActivities(data ?? []));
  }, []);

  useEffect(() => {
    setLoading(true);
    getUnifiedResponses(selectedActivity || undefined).then((data) => { setRows(data); setLoading(false); });
  }, [selectedActivity]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setDropdownOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const loadAnalysis = (view: AnalysisView) => {
    setAnalysisView(view);
    setDropdownOpen(false);
    if (!view) return;
    setAnalysisLoading(true);

    if (view === "employer") {
      employerPerformance(minLearners).then((d) => { setEmployerData(d); setAnalysisLoading(false); });
    } else if (view === "temporal") {
      Promise.all([yearlyComparison(), monthlyTrend(metric)]).then(([y, m]) => { setYearly(y); setMonthly(m); setAnalysisLoading(false); });
    } else if (view === "statistics") {
      Promise.all([descriptiveStats(), pairedTTest()]).then(([d, t]) => { setDesc(d); setTtest(t); setAnalysisLoading(false); });
    } else if (view === "depth") {
      Promise.all([participationDepth(), practiceSettingBreakdown()]).then(([s, ps]) => { setSegments(s); setSettings(ps); setAnalysisLoading(false); });
    }
  };

  const visibleCols = COLUMN_GROUPS.filter((g) => activeGroups.has(g.id)).flatMap((g) => g.cols);
  const filtered = search
    ? rows.filter((r) => r.learner_name.toLowerCase().includes(search.toLowerCase()) || r.email.toLowerCase().includes(search.toLowerCase()))
    : rows;
  const colLabel = (col: string) => col.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const analysisOptions = [
    { id: "employer" as AnalysisView, label: "Employer Analysis", icon: Building2 },
    { id: "temporal" as AnalysisView, label: "Temporal Analysis", icon: CalendarRange },
    { id: "statistics" as AnalysisView, label: "Statistical Tests", icon: FlaskConical },
    { id: "depth" as AnalysisView, label: "Participation Depth", icon: Layers },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Learner Responses</h1>

        {/* Analytics dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              analysisView ? "bg-teal-500 text-white" : "bg-white border border-gray-200 text-navy-600 hover:bg-navy-50"
            }`}
          >
            {analysisView ? analysisOptions.find((o) => o.id === analysisView)?.label : "Run Analysis"}
            <ChevronDown size={16} />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50">
              {analysisView && (
                <button
                  onClick={() => { setAnalysisView(null); setDropdownOpen(false); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  Close Analysis
                </button>
              )}
              {analysisOptions.map((opt) => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.id}
                    onClick={() => loadAnalysis(opt.id)}
                    className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-3 transition-colors ${
                      analysisView === opt.id ? "bg-teal-50 text-teal-600 font-medium" : "text-navy-600 hover:bg-navy-50"
                    }`}
                  >
                    <Icon size={16} />
                    {opt.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Analysis panel */}
      {analysisView && (
        <div className="mb-6">
          {analysisLoading ? <div className="card"><p className="text-navy-400">Loading analysis...</p></div> : (
            <>
              {/* EMPLOYER ANALYSIS */}
              {analysisView === "employer" && (
                <div className="space-y-4">
                  <div className="flex items-center gap-4 mb-2">
                    <label className="text-sm font-medium text-navy-600">Min Learners:</label>
                    <input type="range" min={1} max={50} value={minLearners}
                      onChange={(e) => { setMinLearners(Number(e.target.value)); setAnalysisLoading(true); employerPerformance(Number(e.target.value)).then((d) => { setEmployerData(d); setAnalysisLoading(false); }); }}
                      className="w-48" />
                    <span className="text-sm text-navy-500">{minLearners}</span>
                  </div>
                  <div className="card">
                    <BarChart data={employerData.slice(0, 15)} xKey="employer"
                      yKeys={[{ key: "avg_score_change", color: "#00B4A6", label: "Avg Score Change" }]}
                      title="Top Employers by Score Change" height={300} />
                  </div>
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
                    {employerData.length === 0 ? <p className="p-6 text-navy-400">No employer data available.</p> : (
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
                          {employerData.map((d) => (
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
                </div>
              )}

              {/* TEMPORAL ANALYSIS */}
              {analysisView === "temporal" && (
                <div className="space-y-4">
                  <div className="card">
                    <h2 className="text-lg font-semibold mb-4">Year-over-Year Comparison</h2>
                    {yearly.length === 0 ? <p className="text-navy-400">No data available.</p> : (
                      <>
                        <BarChart data={yearly} xKey="year"
                          yKeys={[
                            { key: "avg_pre_score", color: "#8B99B1", label: "Avg Pre" },
                            { key: "avg_post_score", color: "#00B4A6", label: "Avg Post" },
                          ]}
                          title="Pre vs Post Scores by Year" height={300} />
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
                  <div className="card">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-semibold">Monthly Trends</h2>
                      <select value={metric} onChange={(e) => { setMetric(e.target.value); monthlyTrend(e.target.value).then(setMonthly); }} className="border rounded px-3 py-1 text-sm">
                        <option value="score_change">Score Change</option>
                        <option value="confidence_change">Confidence Change</option>
                      </select>
                    </div>
                    <LineChart data={monthly} xKey="month"
                      yKeys={[{ key: "value", color: "#00B4A6", label: metric === "score_change" ? "Avg Score Change" : "Avg Confidence Change" }]}
                      height={300} />
                  </div>
                </div>
              )}

              {/* STATISTICAL TESTS */}
              {analysisView === "statistics" && (
                <div className="space-y-4">
                  <div className="card">
                    <h2 className="text-lg font-semibold mb-4">Descriptive Statistics</h2>
                    {desc.length === 0 || desc.every((d) => d.n === 0) ? (
                      <p className="text-navy-400">No data available for statistical analysis.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <thead className="bg-navy-50">
                            <tr>
                              <th className="px-4 py-2 text-left font-medium text-navy-500">Metric</th>
                              <th className="px-4 py-2 text-left font-medium text-navy-500">N</th>
                              <th className="px-4 py-2 text-left font-medium text-navy-500">Mean</th>
                              <th className="px-4 py-2 text-left font-medium text-navy-500">Median</th>
                              <th className="px-4 py-2 text-left font-medium text-navy-500">Std Dev</th>
                              <th className="px-4 py-2 text-left font-medium text-navy-500">Min</th>
                              <th className="px-4 py-2 text-left font-medium text-navy-500">Max</th>
                              <th className="px-4 py-2 text-left font-medium text-navy-500">95% CI</th>
                            </tr>
                          </thead>
                          <tbody>
                            {desc.map((d) => (
                              <tr key={d.metric} className="border-t">
                                <td className="px-4 py-2 font-medium">{d.metric}</td>
                                <td className="px-4 py-2">{d.n}</td>
                                <td className="px-4 py-2">{d.mean ?? "—"}</td>
                                <td className="px-4 py-2">{d.median ?? "—"}</td>
                                <td className="px-4 py-2">{d.stdDev ?? "—"}</td>
                                <td className="px-4 py-2">{d.min ?? "—"}</td>
                                <td className="px-4 py-2">{d.max ?? "—"}</td>
                                <td className="px-4 py-2">{d.ci95 ? `[${d.ci95[0]}, ${d.ci95[1]}]` : "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                  <div className="card">
                    <h2 className="text-lg font-semibold mb-4">Paired t-Test (Pre vs Post Score)</h2>
                    {!ttest ? (
                      <p className="text-navy-400">Insufficient data for paired t-test (need at least 2 paired observations).</p>
                    ) : (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="p-3 bg-navy-50 rounded-lg text-center">
                            <div className="text-xl font-bold">{ttest.tStatistic}</div>
                            <div className="text-xs text-navy-400">t-Statistic</div>
                          </div>
                          <div className="p-3 bg-navy-50 rounded-lg text-center">
                            <div className={`text-xl font-bold ${ttest.pValue < 0.05 ? "text-teal-600" : ""}`}>{ttest.pValue < 0.001 ? "< 0.001" : ttest.pValue}</div>
                            <div className="text-xs text-navy-400">p-Value</div>
                          </div>
                          <div className="p-3 bg-navy-50 rounded-lg text-center">
                            <div className="text-xl font-bold">{ttest.degreesOfFreedom}</div>
                            <div className="text-xs text-navy-400">df</div>
                          </div>
                          <div className="p-3 bg-navy-50 rounded-lg text-center">
                            <div className="text-xl font-bold">{ttest.cohensD}</div>
                            <div className="text-xs text-navy-400">Cohen&apos;s d</div>
                          </div>
                        </div>
                        <p className="text-sm text-navy-600 bg-teal-50 p-3 rounded-lg">{ttest.interpretation}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* PARTICIPATION DEPTH */}
              {analysisView === "depth" && (
                <div className="space-y-4">
                  <div className="card">
                    <h2 className="text-lg font-semibold mb-4">Depth Segments</h2>
                    {segments.length === 0 ? <p className="text-navy-400">No data available.</p> : (
                      <>
                        <BarChart data={segments} xKey="segment"
                          yKeys={[
                            { key: "avg_pre_score", color: "#8B99B1", label: "Avg Pre" },
                            { key: "avg_post_score", color: "#00B4A6", label: "Avg Post" },
                          ]}
                          title="Scores by Participation Depth" height={300} />
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
                  <div className="card">
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
              )}
            </>
          )}
        </div>
      )}

      {/* Responses table */}
      <div className="flex flex-wrap gap-4 mb-4 items-end">
        <div>
          <label className="block text-sm font-medium text-navy-600 mb-1">Activity</label>
          <select
            value={selectedActivity}
            onChange={(e) => setSelectedActivity(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm bg-white min-w-[200px]"
          >
            <option value="">All Activities</option>
            {activities.map((a) => (
              <option key={a.activity_id} value={a.activity_id}>{a.activity_name}</option>
            ))}
          </select>
        </div>
        <input
          type="text"
          placeholder="Search learners..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm"
        />
      </div>

      <div className="mb-4">
        <ColumnGroupToggle groups={COLUMN_GROUPS} active={activeGroups} onChange={setActiveGroups} />
      </div>

      <p className="text-sm text-navy-400 mb-2">{filtered.length} records</p>

      {loading ? <p className="text-navy-400">Loading...</p> : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
          {filtered.length === 0 ? <p className="p-6 text-navy-400">No data available.</p> : (
            <table className="min-w-full text-sm">
              <thead className="bg-navy-50">
                <tr>
                  {visibleCols.map((col) => (
                    <th key={col} className="px-4 py-3 text-left font-medium text-navy-500 whitespace-nowrap">{colLabel(col)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((row, i) => (
                  <tr key={i} className={`border-t ${i % 2 === 0 ? "" : "bg-navy-50"}`}>
                    {visibleCols.map((col) => {
                      const val = row[col];
                      const isChange = col.includes("change");
                      const num = typeof val === "number" ? val : null;
                      return (
                        <td
                          key={col}
                          className={`px-4 py-2 whitespace-nowrap ${
                            isChange && num != null && num > 0 ? "text-teal-600 font-medium" : isChange && num != null && num < 0 ? "text-red-600" : ""
                          }`}
                        >
                          {val != null ? String(val) : "—"}
                        </td>
                      );
                    })}
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
