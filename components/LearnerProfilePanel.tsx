"use client";

import type { LearnerProfile } from "@/lib/queries/learners";
import { X } from "lucide-react";

interface Props {
  profile: LearnerProfile;
  onClose: () => void;
}

export default function LearnerProfilePanel({ profile, onClose }: Props) {
  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-lg bg-white shadow-xl z-50 overflow-y-auto">
      <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
        <h2 className="text-lg font-bold">
          {profile.first_name ?? ""} {profile.last_name ?? profile.email}
        </h2>
        <button onClick={onClose} className="p-1 hover:bg-navy-50 rounded"><X size={20} /></button>
      </div>

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><span className="text-navy-400">Email:</span> {profile.email}</div>
          <div><span className="text-navy-400">Employer:</span> {profile.employer_normalized ?? "—"}</div>
          <div><span className="text-navy-400">Practice Setting:</span> {profile.practice_setting ?? "—"}</div>
          <div><span className="text-navy-400">Role:</span> {profile.role ?? "—"}</div>
        </div>

        <div>
          <h3 className="font-semibold mb-3">Activity History ({profile.participations.length})</h3>
          {profile.participations.length === 0 ? (
            <p className="text-navy-400 text-sm">No participations recorded.</p>
          ) : (
            <div className="space-y-2">
              {profile.participations.map((p) => (
                <div key={p.id} className="p-3 bg-navy-50 rounded-lg text-sm">
                  <div className="font-medium">{p.activity_name}</div>
                  <div className="flex gap-4 mt-1 text-navy-400">
                    <span>Date: {p.participation_date ?? "—"}</span>
                    <span>Pre: {p.pre_score ?? "—"}</span>
                    <span>Post: {p.post_score ?? "—"}</span>
                    <span className={p.score_change != null && p.score_change > 0 ? "text-teal-600 font-medium" : ""}>
                      Change: {p.score_change != null ? `${p.score_change > 0 ? "+" : ""}${p.score_change}` : "—"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
