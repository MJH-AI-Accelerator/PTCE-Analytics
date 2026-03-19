"use client";

import { useEffect, useState } from "react";
import { getLearnersList, getLearnerProfile } from "@/lib/queries/learners";
import type { LearnerSummary, LearnerProfile } from "@/lib/queries/learners";
import LearnerProfilePanel from "@/components/LearnerProfilePanel";

export default function LearnerExplorer() {
  const [learners, setLearners] = useState<LearnerSummary[]>([]);
  const [search, setSearch] = useState("");
  const [profile, setProfile] = useState<LearnerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const perPage = 25;

  useEffect(() => {
    getLearnersList().then((data) => { setLearners(data); setLoading(false); });
  }, []);

  const filtered = search
    ? learners.filter(
        (l) =>
          l.email.toLowerCase().includes(search.toLowerCase()) ||
          l.first_name?.toLowerCase().includes(search.toLowerCase()) ||
          l.last_name?.toLowerCase().includes(search.toLowerCase())
      )
    : learners;

  const paged = filtered.slice(page * perPage, (page + 1) * perPage);
  const totalPages = Math.ceil(filtered.length / perPage);

  const openProfile = async (id: number) => {
    const p = await getLearnerProfile(id);
    setProfile(p);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Learner Explorer</h1>

      <input
        type="text"
        placeholder="Search by name or email..."
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(0); }}
        className="w-full max-w-md border rounded-lg px-4 py-2 text-sm mb-4"
      />

      <p className="text-sm text-navy-400 mb-4">{filtered.length} learners found</p>

      {loading ? <p className="text-navy-400">Loading...</p> : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
          {paged.length === 0 ? <p className="p-6 text-navy-400">No learners found.</p> : (
            <table className="min-w-full text-sm">
              <thead className="bg-navy-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-navy-500">Name</th>
                  <th className="px-4 py-3 text-left font-medium text-navy-500">Email</th>
                  <th className="px-4 py-3 text-left font-medium text-navy-500">Employer</th>
                  <th className="px-4 py-3 text-left font-medium text-navy-500">Practice Setting</th>
                  <th className="px-4 py-3 text-left font-medium text-navy-500">Activities</th>
                  <th className="px-4 py-3 text-left font-medium text-navy-500">Avg Change</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((l) => (
                  <tr key={l.id} onClick={() => openProfile(l.id)} className="border-t cursor-pointer hover:bg-navy-50">
                    <td className="px-4 py-3 font-medium">{[l.first_name, l.last_name].filter(Boolean).join(" ") || "—"}</td>
                    <td className="px-4 py-3">{l.email}</td>
                    <td className="px-4 py-3">{l.employer_normalized ?? "—"}</td>
                    <td className="px-4 py-3">{l.practice_setting ?? "—"}</td>
                    <td className="px-4 py-3">{l.activity_count}</td>
                    <td className="px-4 py-3">{l.avg_score_change != null ? `${l.avg_score_change > 0 ? "+" : ""}${l.avg_score_change}%` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex gap-2 mt-4 items-center justify-center">
          <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="px-3 py-1 border rounded text-sm disabled:opacity-50">Prev</button>
          <span className="text-sm text-navy-400">Page {page + 1} of {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="px-3 py-1 border rounded text-sm disabled:opacity-50">Next</button>
        </div>
      )}

      {profile && <LearnerProfilePanel profile={profile} onClose={() => setProfile(null)} />}
    </div>
  );
}
