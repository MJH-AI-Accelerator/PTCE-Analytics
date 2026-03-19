"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { exportToExcel } from "@/lib/export/excel";
import { exportToPDF } from "@/lib/export/pdf";

type ExportType = "full" | "learners" | "questions" | "employers";
type ExportFormat = "xlsx" | "pdf";

export default function ExportPage() {
  const [type, setType] = useState<ExportType>("full");
  const [format, setFormat] = useState<ExportFormat>("xlsx");
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      if (format === "xlsx") {
        const [{ data: learners }, { data: parts }, { data: activities }] = await Promise.all([
          supabase.from("learners").select("*"),
          supabase.from("participations").select("*"),
          supabase.from("activities").select("*"),
        ]);

        const sheets = [];
        if (type === "full" || type === "learners") {
          sheets.push({ name: "Learners", data: (learners ?? []) as Record<string, unknown>[] });
          sheets.push({ name: "Participations", data: (parts ?? []) as Record<string, unknown>[] });
        }
        if (type === "full") {
          sheets.push({ name: "Activities", data: (activities ?? []) as Record<string, unknown>[] });
        }
        if (type === "employers") {
          const { data: aliases } = await supabase.from("employer_aliases").select("*");
          sheets.push({ name: "Employer Aliases", data: (aliases ?? []) as Record<string, unknown>[] });
        }

        exportToExcel(sheets, `ptce-${type}-export.xlsx`);
      } else {
        const { data: parts } = await supabase.from("participations").select("id, learner_id, activity_id, pre_score, post_score, score_change").limit(100);
        const rows = (parts ?? []).map((p: { id: number; learner_id: number; activity_id: string; pre_score: number | null; post_score: number | null; score_change: number | null }) => [
          String(p.id),
          String(p.learner_id),
          p.activity_id,
          String(p.pre_score ?? "—"),
          String(p.post_score ?? "—"),
          String(p.score_change ?? "—"),
        ]);
        const sections = [
          {
            title: "Participation Summary",
            headers: ["ID", "Learner ID", "Activity ID", "Pre Score", "Post Score", "Change"],
            rows,
          },
        ];
        exportToPDF("PTCE Analytics Report", sections, `ptce-${type}-report.pdf`);
      }
    } catch (err) {
      console.error("Export failed:", err);
    }
    setExporting(false);
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Export</h1>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-navy-600 mb-2">Export Type</label>
          <div className="grid grid-cols-2 gap-3">
            {([
              { id: "full", label: "Full Report", desc: "All data" },
              { id: "learners", label: "Learner Data", desc: "Learners & participations" },
              { id: "questions", label: "Question Analysis", desc: "Question responses" },
              { id: "employers", label: "Employer Analysis", desc: "Employer aliases & stats" },
            ] as { id: ExportType; label: string; desc: string }[]).map((opt) => (
              <button
                key={opt.id}
                onClick={() => setType(opt.id)}
                className={`p-3 border rounded-lg text-left transition-colors ${type === opt.id ? "border-teal-500 bg-teal-50" : "hover:bg-navy-50"}`}
              >
                <div className="font-medium text-sm">{opt.label}</div>
                <div className="text-xs text-navy-400">{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-navy-600 mb-2">Format</label>
          <div className="flex gap-3">
            <button
              onClick={() => setFormat("xlsx")}
              className={`px-4 py-2 border rounded-lg text-sm ${format === "xlsx" ? "border-teal-500 bg-teal-50 font-medium" : "hover:bg-navy-50"}`}
            >
              Excel (.xlsx)
            </button>
            <button
              onClick={() => setFormat("pdf")}
              className={`px-4 py-2 border rounded-lg text-sm ${format === "pdf" ? "border-teal-500 bg-teal-50 font-medium" : "hover:bg-navy-50"}`}
            >
              PDF
            </button>
          </div>
        </div>

        <button
          onClick={handleExport}
          disabled={exporting}
          className="w-full px-4 py-3 bg-teal-500 text-white rounded-lg font-medium hover:bg-teal-600 disabled:opacity-50"
        >
          {exporting ? "Generating..." : "Generate Export"}
        </button>
      </div>
    </div>
  );
}
