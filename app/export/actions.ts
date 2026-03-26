"use server";

import { getServiceClient } from "@/lib/supabase";

export type ExportType = "full" | "learners" | "questions" | "employers";

interface ExportSheet {
  name: string;
  data: Record<string, unknown>[];
}

interface PdfRow {
  id: string;
  learner_id: string;
  activity_id: string;
  pre_score: string;
  post_score: string;
  score_change: string;
}

export async function getExportSheets(type: ExportType): Promise<ExportSheet[]> {
  const supabase = getServiceClient();
  const sheets: ExportSheet[] = [];

  if (type === "full" || type === "learners") {
    const [{ data: learners }, { data: parts }] = await Promise.all([
      supabase.from("learners").select("*"),
      supabase.from("participations").select("*"),
    ]);
    sheets.push({ name: "Learners", data: (learners ?? []) as Record<string, unknown>[] });
    sheets.push({ name: "Participations", data: (parts ?? []) as Record<string, unknown>[] });
  }

  if (type === "full") {
    const { data: activities } = await supabase.from("activities").select("*");
    sheets.push({ name: "Activities", data: (activities ?? []) as Record<string, unknown>[] });
  }

  if (type === "employers") {
    const { data: aliases } = await supabase.from("employer_aliases").select("*");
    sheets.push({ name: "Employer Aliases", data: (aliases ?? []) as Record<string, unknown>[] });
  }

  return sheets;
}

export async function getExportPdfRows(): Promise<PdfRow[]> {
  const supabase = getServiceClient();
  const { data: parts } = await supabase
    .from("participations")
    .select("id, learner_id, activity_id, pre_score, post_score, score_change")
    .limit(100);

  return (parts ?? []).map((p: { id: number; learner_id: number; activity_id: string; pre_score: number | null; post_score: number | null; score_change: number | null }) => ({
    id: String(p.id),
    learner_id: String(p.learner_id),
    activity_id: p.activity_id,
    pre_score: String(p.pre_score ?? "—"),
    post_score: String(p.post_score ?? "—"),
    score_change: String(p.score_change ?? "—"),
  }));
}
