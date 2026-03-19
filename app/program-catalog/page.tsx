"use client";

import { useEffect, useState } from "react";
import { getActivityCatalog, getActivityDetail, searchQuestions, findIdenticalQuestions } from "@/lib/queries/catalog";
import type { CatalogEntry, ActivityDetail, QuestionSearchResult, IdenticalQuestionGroup } from "@/lib/queries/catalog";
import ActivityDetailPanel from "@/components/ActivityDetailPanel";
import { SearchResults, IdenticalResults } from "@/components/QuestionSearchResults";

type Tab = "activities" | "search" | "identical";

export default function ProgramCatalog() {
  const [tab, setTab] = useState<Tab>("activities");
  const [activities, setActivities] = useState<CatalogEntry[]>([]);
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<ActivityDetail | null>(null);
  const [questionSearch, setQuestionSearch] = useState("");
  const [questionResults, setQuestionResults] = useState<QuestionSearchResult[]>([]);
  const [identicalGroups, setIdenticalGroups] = useState<IdenticalQuestionGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<string>("activity_date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    getActivityCatalog().then((data) => { setActivities(data); setLoading(false); });
  }, []);

  useEffect(() => {
    if (tab === "identical") {
      findIdenticalQuestions().then(setIdenticalGroups);
    }
  }, [tab]);

  const handleQuestionSearch = async () => {
    if (!questionSearch.trim()) return;
    const results = await searchQuestions(questionSearch);
    setQuestionResults(results);
  };

  const openDetail = async (id: string) => {
    const d = await getActivityDetail(id);
    setDetail(d);
  };

  const filtered = search
    ? activities.filter((a) =>
        a.activity_name.toLowerCase().includes(search.toLowerCase()) ||
        a.activity_id.toLowerCase().includes(search.toLowerCase())
      )
    : activities;

  const sorted = [...filtered].sort((a, b) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const av = (a as any)[sortKey];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bv = (b as any)[sortKey];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
    return sortDir === "asc" ? cmp : -cmp;
  });

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  const tabs = [
    { id: "activities" as Tab, label: "Activities" },
    { id: "search" as Tab, label: "Search Questions" },
    { id: "identical" as Tab, label: "Identical Questions" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Program Catalog</h1>

      <div className="flex gap-1 mb-6 border-b">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t.id ? "border-teal-500 text-teal-600" : "border-transparent text-navy-400 hover:text-navy-600"}`}
          >{t.label}</button>
        ))}
      </div>

      {tab === "activities" && (
        <>
          <input
            type="text"
            placeholder="Search activities..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-md border rounded-lg px-4 py-2 text-sm mb-4"
          />
          {loading ? <p className="text-navy-400">Loading...</p> : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
              {sorted.length === 0 ? <p className="p-6 text-navy-400">No activities found.</p> : (
                <table className="min-w-full text-sm">
                  <thead className="bg-navy-50">
                    <tr>
                      {[
                        { key: "activity_id", label: "ID" },
                        { key: "activity_name", label: "Name" },
                        { key: "activity_type", label: "Type" },
                        { key: "activity_date", label: "Date" },
                        { key: "learner_count", label: "Learners" },
                        { key: "avg_score_change", label: "Avg Change" },
                      ].map((col) => (
                        <th key={col.key}
                          onClick={() => handleSort(col.key)}
                          className="px-4 py-3 text-left font-medium text-navy-500 cursor-pointer hover:text-navy-800"
                        >
                          {col.label} {sortKey === col.key && (sortDir === "asc" ? "↑" : "↓")}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((a) => (
                      <tr key={a.activity_id} onClick={() => openDetail(a.activity_id)}
                        className="border-t cursor-pointer hover:bg-navy-50">
                        <td className="px-4 py-3">{a.activity_id}</td>
                        <td className="px-4 py-3 font-medium">{a.activity_name}</td>
                        <td className="px-4 py-3">{a.activity_type ?? "—"}</td>
                        <td className="px-4 py-3">{a.activity_date ?? "—"}</td>
                        <td className="px-4 py-3">{a.learner_count}</td>
                        <td className="px-4 py-3">{a.avg_score_change != null ? `${a.avg_score_change > 0 ? "+" : ""}${a.avg_score_change}%` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </>
      )}

      {tab === "search" && (
        <div>
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              placeholder="Search question text..."
              value={questionSearch}
              onChange={(e) => setQuestionSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleQuestionSearch()}
              className="flex-1 max-w-md border rounded-lg px-4 py-2 text-sm"
            />
            <button onClick={handleQuestionSearch} className="px-4 py-2 bg-teal-500 text-white rounded-lg text-sm hover:bg-teal-600">Search</button>
          </div>
          <SearchResults results={questionResults} />
        </div>
      )}

      {tab === "identical" && <IdenticalResults groups={identicalGroups} />}

      {detail && <ActivityDetailPanel detail={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}
