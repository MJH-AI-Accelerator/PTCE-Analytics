"use client";

import { useEffect, useState } from "react";
import { getUnifiedResponses, type UnifiedRow } from "@/lib/queries/responses";
import { supabase } from "@/lib/supabase";
import ColumnGroupToggle from "@/components/ColumnGroupToggle";

const COLUMN_GROUPS = [
  { id: "demo", label: "Demographics", cols: ["learner_name", "email", "employer"] },
  { id: "scores", label: "Scores", cols: ["pre_score", "post_score", "score_change"] },
  { id: "confidence", label: "Confidence", cols: ["pre_confidence", "post_confidence", "confidence_change"] },
];

export default function LearnerResponses() {
  const [rows, setRows] = useState<UnifiedRow[]>([]);
  const [activities, setActivities] = useState<{ activity_id: string; activity_name: string }[]>([]);
  const [selectedActivity, setSelectedActivity] = useState("");
  const [activeGroups, setActiveGroups] = useState(new Set(COLUMN_GROUPS.map((g) => g.id)));
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.from("activities").select("activity_id, activity_name").then(({ data }) => setActivities(data ?? []));
  }, []);

  useEffect(() => {
    setLoading(true);
    getUnifiedResponses(selectedActivity || undefined).then((data) => { setRows(data); setLoading(false); });
  }, [selectedActivity]);

  const visibleCols = COLUMN_GROUPS.filter((g) => activeGroups.has(g.id)).flatMap((g) => g.cols);

  const filtered = search
    ? rows.filter((r) => r.learner_name.toLowerCase().includes(search.toLowerCase()) || r.email.toLowerCase().includes(search.toLowerCase()))
    : rows;

  const colLabel = (col: string) => col.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Learner Responses</h1>

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
