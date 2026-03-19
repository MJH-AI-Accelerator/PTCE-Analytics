import { SupabaseClient } from "@supabase/supabase-js";
import { resolveOrCreateLearner } from "./identity-resolver";
import { normalizeConfidence, normalizeScore, normalizeEmployer } from "./normalizer";

export interface ActivityMetadata {
  activity_id: string;
  activity_name: string;
  activity_type?: string;
  activity_date?: string;
  therapeutic_area?: string;
  disease_state?: string;
  sponsor?: string;
}

export interface IngestResult {
  learnersCreated: number;
  learnersUpdated: number;
  participationsCreated: number;
  errors: string[];
}

export async function ingestData(
  supabase: SupabaseClient,
  rows: Record<string, unknown>[],
  mapping: Record<string, string | null>,
  activity: ActivityMetadata
): Promise<IngestResult> {
  const result: IngestResult = {
    learnersCreated: 0,
    learnersUpdated: 0,
    participationsCreated: 0,
    errors: [],
  };

  // Upsert activity
  await supabase.from("activities").upsert({
    activity_id: activity.activity_id,
    activity_name: activity.activity_name,
    activity_type: activity.activity_type ?? null,
    activity_date: activity.activity_date ?? null,
    therapeutic_area: activity.therapeutic_area ?? null,
    disease_state: activity.disease_state ?? null,
    sponsor: activity.sponsor ?? null,
  });

  const getValue = (row: Record<string, unknown>, field: string): string | null => {
    const col = mapping[field];
    if (!col) return null;
    const val = row[col];
    return val != null && val !== "" ? String(val) : null;
  };

  // Track existing learners to count created vs updated
  const seenEmails = new Set<string>();
  const { data: existingLearners } = await supabase.from("learners").select("email");
  const existingEmails = new Set((existingLearners ?? []).map((l) => l.email));

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const email = getValue(row, "email");
      if (!email) {
        result.errors.push(`Row ${i + 1}: Missing email`);
        continue;
      }

      const employerRaw = getValue(row, "employer");
      const employerNormalized = employerRaw ? normalizeEmployer(employerRaw) : null;

      const isNew = !existingEmails.has(email.trim().toLowerCase()) && !seenEmails.has(email.trim().toLowerCase());

      const learnerId = await resolveOrCreateLearner(supabase, {
        email,
        first_name: getValue(row, "first_name"),
        last_name: getValue(row, "last_name"),
        employer_raw: employerRaw,
        employer_normalized: employerNormalized,
        practice_setting: getValue(row, "practice_setting"),
        role: getValue(row, "role"),
      });

      if (isNew) {
        result.learnersCreated++;
        seenEmails.add(email.trim().toLowerCase());
      } else if (!seenEmails.has(email.trim().toLowerCase())) {
        result.learnersUpdated++;
        seenEmails.add(email.trim().toLowerCase());
      }

      // Parse scores
      const preScore = normalizeScore(getValue(row, "pre_score"));
      const postScore = normalizeScore(getValue(row, "post_score"));
      const scoreChange = preScore != null && postScore != null ? postScore - preScore : null;

      const preConf = normalizeConfidence(getValue(row, "pre_confidence"));
      const postConf = normalizeConfidence(getValue(row, "post_confidence"));
      const confChange = preConf != null && postConf != null ? postConf - preConf : null;

      const { error: pError } = await supabase.from("participations").upsert(
        {
          learner_id: learnerId,
          activity_id: activity.activity_id,
          participation_date: getValue(row, "activity_date") ?? activity.activity_date ?? null,
          pre_score: preScore,
          post_score: postScore,
          score_change: scoreChange,
          pre_confidence_avg: preConf,
          post_confidence_avg: postConf,
          confidence_change: confChange,
          comments: getValue(row, "comments"),
        },
        { onConflict: "learner_id,activity_id" }
      );

      if (pError) {
        result.errors.push(`Row ${i + 1}: ${pError.message}`);
      } else {
        result.participationsCreated++;
      }
    } catch (err) {
      result.errors.push(`Row ${i + 1}: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  return result;
}
