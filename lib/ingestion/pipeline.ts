import { SupabaseClient } from "@supabase/supabase-js";
import { resolveOrCreateLearner } from "./identity-resolver";
import { normalizeConfidence, normalizeScore, normalizeEmployer } from "./normalizer";
import { upsertQuestions, insertQuestionResponses } from "./question-storage";
import { insertEvaluationResponses } from "./evaluation-storage";
import { resolveEmailAlias, findPotentialEmailMatches, flagEmailMatch } from "./email-alias-resolver";
import type { ParsedActivityData, DataSource } from "@/lib/parsers/types";

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
  questionsCreated: number;
  responsesCreated: number;
  evaluationResponsesCreated: number;
  emailAliasesFlagged: number;
  errors: string[];
  warnings: string[];
}

/**
 * Legacy ingestData for backward compatibility with the old column-mapping flow.
 */
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
    questionsCreated: 0,
    responsesCreated: 0,
    evaluationResponsesCreated: 0,
    emailAliasesFlagged: 0,
    errors: [],
    warnings: [],
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

/**
 * New CIR-based storage pipeline.
 * Consumes ParsedActivityData from any source parser and stores everything.
 */
export async function storeParsedActivityData(
  supabase: SupabaseClient,
  parsed: ParsedActivityData,
  activity: ActivityMetadata
): Promise<IngestResult> {
  const result: IngestResult = {
    learnersCreated: 0,
    learnersUpdated: 0,
    participationsCreated: 0,
    questionsCreated: 0,
    responsesCreated: 0,
    evaluationResponsesCreated: 0,
    emailAliasesFlagged: 0,
    errors: [],
    warnings: parsed.warnings.map((w) => `${w.type}: ${w.message}${w.context ? ` (${w.context})` : ""}`),
  };

  try {
    // 1. Upsert activity with source tracking
    await supabase.from("activities").upsert({
      activity_id: activity.activity_id,
      activity_name: activity.activity_name,
      activity_type: activity.activity_type ?? null,
      activity_date: activity.activity_date ?? null,
      therapeutic_area: activity.therapeutic_area ?? null,
      disease_state: activity.disease_state ?? null,
      sponsor: activity.sponsor ?? null,
      data_source: parsed.source,
      source_file_name: parsed.sourceFileName,
      import_date: new Date().toISOString(),
    });

    // 2. Upsert questions and get ID map
    const questionIdMap = await upsertQuestions(supabase, activity.activity_id, parsed.questions);
    result.questionsCreated = parsed.questions.length;

    // 3. Track existing learners
    const seenEmails = new Set<string>();
    const { data: existingLearners } = await supabase.from("learners").select("email");
    const existingEmails = new Set((existingLearners ?? []).map((l) => l.email));

    // 4. Process each learner
    for (const learner of parsed.learners) {
      try {
        // Email alias resolution
        const resolvedEmail = await resolveEmailAlias(supabase, learner.email);
        const emailLower = resolvedEmail.trim().toLowerCase();

        const employerRaw = learner.employer;
        const employerNormalized = employerRaw ? normalizeEmployer(employerRaw) : null;
        const isNew = !existingEmails.has(emailLower) && !seenEmails.has(emailLower);

        const learnerId = await resolveOrCreateLearner(supabase, {
          email: resolvedEmail,
          first_name: learner.firstName,
          last_name: learner.lastName,
          employer_raw: employerRaw,
          employer_normalized: employerNormalized,
          practice_setting: learner.practiceSetting,
          role: learner.role,
        });

        if (isNew) {
          result.learnersCreated++;
          seenEmails.add(emailLower);
        } else if (!seenEmails.has(emailLower)) {
          result.learnersUpdated++;
          seenEmails.add(emailLower);
        }

        // Upsert participation
        const { data: participation, error: pError } = await supabase
          .from("participations")
          .upsert(
            {
              learner_id: learnerId,
              activity_id: activity.activity_id,
              participation_date: activity.activity_date ?? null,
              pre_score: learner.preScore,
              post_score: learner.postScore,
              score_change: learner.scoreChange,
              pre_confidence_avg: learner.preConfidenceAvg,
              post_confidence_avg: learner.postConfidenceAvg,
              confidence_change: learner.confidenceChange,
              comments: learner.comments,
            },
            { onConflict: "learner_id,activity_id" }
          )
          .select("id")
          .single();

        if (pError) {
          result.errors.push(`${learner.email}: ${pError.message}`);
          continue;
        }
        result.participationsCreated++;

        const participationId = participation!.id;

        // Insert question responses
        if (learner.responses.length > 0) {
          const responseCount = await insertQuestionResponses(
            supabase, participationId, learner.responses, questionIdMap
          );
          result.responsesCreated += responseCount;
        }

        // Insert evaluation responses
        if (learner.evaluationResponses.length > 0) {
          const evalCount = await insertEvaluationResponses(
            supabase, participationId, learner.evaluationResponses
          );
          result.evaluationResponsesCreated += evalCount;
        }

        // Insert presenter responses
        if (learner.presenterResponses.length > 0) {
          for (const pr of learner.presenterResponses) {
            // Upsert presenter question
            const { data: pq } = await supabase
              .from("presenter_questions")
              .upsert(
                {
                  activity_id: activity.activity_id,
                  question_number: pr.questionNumber,
                  question_text: pr.questionText,
                },
                { onConflict: "activity_id,question_number" }
              )
              .select("id")
              .single();

            if (pq) {
              await supabase.from("presenter_responses").insert({
                presenter_question_id: pq.id,
                participation_id: participationId,
                response_text: pr.responseText,
              });
            }
          }
        }

        // Check for potential email aliases (for unmatched eval data)
        if (resolvedEmail === learner.email.trim().toLowerCase() && !existingEmails.has(emailLower)) {
          const match = await findPotentialEmailMatches(
            supabase, learner.email, learner.firstName, learner.lastName
          );
          if (match) {
            await flagEmailMatch(supabase, match.primaryEmail, learner.email, match.confidence);
            result.emailAliasesFlagged++;
          }
        }
      } catch (err) {
        result.errors.push(`${learner.email}: ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    }

    // 5. Create import batch audit record
    await supabase.from("import_batches").insert({
      activity_id: activity.activity_id,
      data_source: parsed.source,
      source_file_name: parsed.sourceFileName,
      learners_created: result.learnersCreated,
      learners_updated: result.learnersUpdated,
      participations_created: result.participationsCreated,
      questions_created: result.questionsCreated,
      responses_created: result.responsesCreated,
      warnings: result.warnings,
      errors: result.errors,
    });
  } catch (err) {
    result.errors.push(`Pipeline error: ${err instanceof Error ? err.message : "Unknown error"}`);
  }

  return result;
}
