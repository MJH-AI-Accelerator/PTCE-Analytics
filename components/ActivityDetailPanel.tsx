"use client";

import type { ActivityDetail } from "@/lib/queries/catalog";
import { X } from "lucide-react";

interface Props {
  detail: ActivityDetail;
  onClose: () => void;
}

export default function ActivityDetailPanel({ detail, onClose }: Props) {
  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-lg bg-white shadow-xl z-50 overflow-y-auto">
      <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
        <h2 className="text-lg font-bold">{detail.activity_name}</h2>
        <button onClick={onClose} className="p-1 hover:bg-navy-50 rounded">
          <X size={20} />
        </button>
      </div>

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><span className="text-navy-400">ID:</span> {detail.activity_id}</div>
          <div><span className="text-navy-400">Type:</span> {detail.activity_type ?? "—"}</div>
          <div><span className="text-navy-400">Date:</span> {detail.activity_date ?? "—"}</div>
          <div><span className="text-navy-400">Area:</span> {detail.therapeutic_area ?? "—"}</div>
          <div><span className="text-navy-400">Disease:</span> {detail.disease_state ?? "—"}</div>
          <div><span className="text-navy-400">Sponsor:</span> {detail.sponsor ?? "—"}</div>
        </div>

        <div className="grid grid-cols-4 gap-3">
          <div className="text-center p-3 bg-navy-50 rounded-lg">
            <div className="text-xl font-bold">{detail.learner_count}</div>
            <div className="text-xs text-navy-400">Learners</div>
          </div>
          <div className="text-center p-3 bg-navy-50 rounded-lg">
            <div className="text-xl font-bold">{detail.avg_pre_score ?? "—"}</div>
            <div className="text-xs text-navy-400">Avg Pre</div>
          </div>
          <div className="text-center p-3 bg-navy-50 rounded-lg">
            <div className="text-xl font-bold">{detail.avg_post_score ?? "—"}</div>
            <div className="text-xs text-navy-400">Avg Post</div>
          </div>
          <div className="text-center p-3 bg-navy-50 rounded-lg">
            <div className="text-xl font-bold">{detail.avg_score_change != null ? `${detail.avg_score_change > 0 ? "+" : ""}${detail.avg_score_change}` : "—"}</div>
            <div className="text-xs text-navy-400">Avg Change</div>
          </div>
        </div>

        {detail.objectives.length > 0 && (
          <div>
            <h3 className="font-semibold mb-2">Learning Objectives</h3>
            <ol className="list-decimal list-inside text-sm space-y-1">
              {detail.objectives.map((o) => (
                <li key={o.id}>{o.objective_text}</li>
              ))}
            </ol>
          </div>
        )}

        {detail.questions.length > 0 && (
          <div>
            <h3 className="font-semibold mb-2">Questions ({detail.questions.length})</h3>
            <div className="space-y-2">
              {detail.questions.map((q) => (
                <div key={q.id} className="text-sm p-2 bg-navy-50 rounded">
                  <span className="inline-block px-2 py-0.5 bg-teal-100 text-teal-700 rounded text-xs mr-2">
                    {q.question_type}
                  </span>
                  {q.question_text}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
