"use client";

import { useEffect, useState } from "react";
import type { EmployerAlias, NormalizationLog } from "@/lib/database.types";
import { getEmployerAliases, getUnmatchedEmployers, getCanonicalEmployers, getNormalizationLog } from "@/lib/queries/employer";
import { findBestMatch } from "@/lib/ingestion/employer-matcher";
import { applyAlias } from "@/lib/ingestion/employer-matcher";
import { supabase } from "@/lib/supabase";

type Tab = "aliases" | "unmatched" | "log";

export default function EmployerManagement() {
  const [tab, setTab] = useState<Tab>("aliases");
  const [aliases, setAliases] = useState<EmployerAlias[]>([]);
  const [unmatched, setUnmatched] = useState<string[]>([]);
  const [canonical, setCanonical] = useState<string[]>([]);
  const [logEntries, setLogEntries] = useState<NormalizationLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [a, u, c, l] = await Promise.all([
        getEmployerAliases(),
        getUnmatchedEmployers(),
        getCanonicalEmployers(),
        getNormalizationLog("employer"),
      ]);
      setAliases(a);
      setUnmatched(u);
      setCanonical(c);
      setLogEntries(l);
      setLoading(false);
    }
    load();
  }, []);

  const handleAcceptMatch = async (rawName: string, canonicalName: string) => {
    await applyAlias(supabase, rawName, canonicalName, "fuzzy_accepted");
    setUnmatched((prev) => prev.filter((n) => n !== rawName));
    const updated = await getEmployerAliases();
    setAliases(updated);
  };

  const tabs = [
    { id: "aliases" as Tab, label: "Alias Table", count: aliases.length },
    { id: "unmatched" as Tab, label: "Unmatched Names", count: unmatched.length },
    { id: "log" as Tab, label: "Normalization Log", count: logEntries.length },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Employer Management</h1>

      <div className="flex gap-1 mb-6 border-b">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.id
                ? "border-teal-500 text-teal-600"
                : "border-transparent text-navy-400 hover:text-navy-600"
            }`}
          >
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-navy-400">Loading...</p>
      ) : (
        <>
          {tab === "aliases" && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
              {aliases.length === 0 ? (
                <p className="p-6 text-navy-400">No aliases configured yet.</p>
              ) : (
                <table className="min-w-full text-sm">
                  <thead className="bg-navy-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-navy-500">Raw Name</th>
                      <th className="px-4 py-3 text-left font-medium text-navy-500">Canonical Name</th>
                      <th className="px-4 py-3 text-left font-medium text-navy-500">Method</th>
                      <th className="px-4 py-3 text-left font-medium text-navy-500">Confidence</th>
                      <th className="px-4 py-3 text-left font-medium text-navy-500">Reviewed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aliases.map((a) => (
                      <tr key={a.id} className="border-t">
                        <td className="px-4 py-3">{a.raw_name}</td>
                        <td className="px-4 py-3 font-medium">{a.canonical_name}</td>
                        <td className="px-4 py-3">{a.match_method}</td>
                        <td className="px-4 py-3">{a.confidence ? `${Math.round(a.confidence * 100)}%` : "—"}</td>
                        <td className="px-4 py-3">{a.reviewed ? "Yes" : "No"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {tab === "unmatched" && (
            <div className="space-y-3">
              {unmatched.length === 0 ? (
                <p className="text-navy-400">All employer names are matched.</p>
              ) : (
                unmatched.map((name) => {
                  const suggestion = findBestMatch(name, canonical);
                  return (
                    <div key={name} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-center justify-between">
                      <div>
                        <span className="font-medium">{name}</span>
                        {suggestion.match && (
                          <span className="ml-3 text-sm text-navy-400">
                            Suggested: <span className="font-medium text-teal-600">{suggestion.match}</span>
                            {" "}({Math.round(suggestion.score * 100)}%)
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {suggestion.match && (
                          <button
                            onClick={() => handleAcceptMatch(name, suggestion.match!)}
                            className="px-3 py-1 bg-teal-600 text-white rounded text-sm hover:bg-teal-700"
                          >
                            Accept
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {tab === "log" && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
              {logEntries.length === 0 ? (
                <p className="p-6 text-navy-400">No normalization log entries.</p>
              ) : (
                <table className="min-w-full text-sm">
                  <thead className="bg-navy-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-navy-500">Field</th>
                      <th className="px-4 py-3 text-left font-medium text-navy-500">Original</th>
                      <th className="px-4 py-3 text-left font-medium text-navy-500">Normalized</th>
                      <th className="px-4 py-3 text-left font-medium text-navy-500">Method</th>
                      <th className="px-4 py-3 text-left font-medium text-navy-500">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logEntries.map((entry) => (
                      <tr key={entry.id} className="border-t">
                        <td className="px-4 py-3">{entry.field_name}</td>
                        <td className="px-4 py-3">{entry.original_value}</td>
                        <td className="px-4 py-3">{entry.normalized_value}</td>
                        <td className="px-4 py-3">{entry.method}</td>
                        <td className="px-4 py-3 text-navy-400">{entry.created_at ? new Date(entry.created_at).toLocaleDateString() : "—"}</td>
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
