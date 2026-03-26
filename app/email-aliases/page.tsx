"use client";

import { useEffect, useState } from "react";
import type { EmailAlias } from "@/lib/database.types";
import { Check, X, AlertCircle, Mail, RefreshCw } from "lucide-react";
import { getEmailAliases, approveAlias, rejectAlias } from "./actions";

export default function EmailAliasesPage() {
  const [aliases, setAliases] = useState<EmailAlias[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"unreviewed" | "all">("unreviewed");

  const loadAliases = async () => {
    setLoading(true);
    const data = await getEmailAliases(filter);
    setAliases(data);
    setLoading(false);
  };

  useEffect(() => {
    loadAliases();
  }, [filter]);

  const handleApprove = async (alias: EmailAlias) => {
    await approveAlias(alias.id);
    loadAliases();
  };

  const handleReject = async (alias: EmailAlias) => {
    await rejectAlias(alias.id);
    loadAliases();
  };

  const unreviewed = aliases.filter((a) => !a.reviewed);
  const reviewed = aliases.filter((a) => a.reviewed);

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Email Alias Review</h1>
          <p className="text-sm text-navy-400 mt-1">
            Review flagged email matches from cross-platform imports
          </p>
        </div>
        <button
          onClick={loadAliases}
          className="flex items-center gap-2 px-3 py-2 border rounded-lg text-sm hover:bg-navy-50"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setFilter("unreviewed")}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            filter === "unreviewed"
              ? "bg-amber-100 text-amber-700"
              : "bg-navy-50 text-navy-400 hover:text-navy-600"
          }`}
        >
          Needs Review {unreviewed.length > 0 && `(${unreviewed.length})`}
        </button>
        <button
          onClick={() => setFilter("all")}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            filter === "all"
              ? "bg-teal-100 text-teal-700"
              : "bg-navy-50 text-navy-400 hover:text-navy-600"
          }`}
        >
          All Aliases
        </button>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <div className="animate-pulse text-navy-300">Loading...</div>
        </div>
      ) : aliases.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <Mail className="mx-auto mb-3 text-navy-200" size={40} />
          <p className="text-navy-400 font-medium">No email aliases to review</p>
          <p className="text-sm text-navy-300 mt-1">
            Flagged matches will appear here after importing data from multiple sources
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-navy-50 text-navy-600">
                <th className="text-left px-4 py-3 font-medium">Primary Email</th>
                <th className="text-left px-4 py-3 font-medium">Alias Email</th>
                <th className="text-center px-4 py-3 font-medium">Confidence</th>
                <th className="text-center px-4 py-3 font-medium">Status</th>
                <th className="text-right px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {aliases.map((alias) => (
                <tr key={alias.id} className="hover:bg-navy-50/50">
                  <td className="px-4 py-3 font-mono text-xs">{alias.primary_email}</td>
                  <td className="px-4 py-3 font-mono text-xs">{alias.alias_email}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                      alias.confidence === "high"
                        ? "bg-teal-100 text-teal-700"
                        : "bg-amber-100 text-amber-700"
                    }`}>
                      {alias.confidence === "high" ? "High" : "Medium"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {alias.reviewed ? (
                      <span className="text-teal-600 text-xs font-medium">Approved</span>
                    ) : (
                      <span className="text-amber-600 text-xs font-medium flex items-center justify-center gap-1">
                        <AlertCircle size={12} /> Pending
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {!alias.reviewed && (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleApprove(alias)}
                          className="flex items-center gap-1 px-3 py-1 bg-teal-500 text-white rounded text-xs hover:bg-teal-600"
                          title="Approve match"
                        >
                          <Check size={12} /> Approve
                        </button>
                        <button
                          onClick={() => handleReject(alias)}
                          className="flex items-center gap-1 px-3 py-1 bg-red-100 text-red-600 rounded text-xs hover:bg-red-200"
                          title="Reject match"
                        >
                          <X size={12} /> Reject
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
