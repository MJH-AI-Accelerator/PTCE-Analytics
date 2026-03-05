# TASK07 — Data Ingestion Pipeline (Server Action)

## Phase
Phase 2: Data Ingestion

## What to Build
Create a Server Action that receives parsed file data, column mappings, and activity metadata, then writes everything to Supabase. Port the normalizer and identity resolver from Python.

## Reference
- `src/ingestion/normalizer.py` — confidence label→number, score parsing, employer normalization
- `src/identity/resolver.py` — find-or-create learner by email, update fields

## Steps

1. **Normalizer** (`lib/ingestion/normalizer.ts`):
   - `normalizeConfidence(value: string | number): number | null` — convert Likert labels to 1-5 scale (Not at all confident=1, Somewhat=2, Moderately=3, Very=4, Extremely=5), pass through numbers
   - `normalizeScore(value: string | number): number | null` — handle percentages ("80%"), fractions ("8/10"), raw numbers
   - `normalizeEmployer(raw: string): string` — trim, title-case, strip common suffixes (Inc, LLC, Corp)

2. **Identity resolver** (`lib/ingestion/identity-resolver.ts`):
   - `resolveOrCreateLearner(supabase, learnerData)` — upsert by email: if exists, update non-null fields; if new, insert
   - Return learner_id for participation linking

3. **Ingestion pipeline** (`lib/ingestion/pipeline.ts`):
   - `ingestData(rows, mapping, activityMetadata)`:
     1. Upsert activity record
     2. For each row: resolve learner → create participation → create question_responses if question columns mapped
     3. Compute aggregate scores (pre_score, post_score, score_change) from question responses
     4. Log normalizations to normalization_log
   - Return `{ learnersCreated, learnersUpdated, participationsCreated, errors }`

4. **Server Action** (`app/data-import/actions.ts`):
   - `"use server"` action wrapping the pipeline
   - Accept: `{ rows: Record<string, any>[], mapping: Record<string, string>, activity: ActivityMetadata }`
   - Call pipeline, return result summary

5. **Wire into Data Import page**:
   - Step 4 "Import" button calls the server action
   - Show progress/spinner during import
   - Display results: learners created/updated, participations, errors

## Files to Create/Modify
- `lib/ingestion/normalizer.ts` (new)
- `lib/ingestion/identity-resolver.ts` (new)
- `lib/ingestion/pipeline.ts` (new)
- `app/data-import/actions.ts` (new)
- `app/data-import/page.tsx` (modify — wire Step 4)

## Browser Verification
- Upload a test file, map columns, fill activity info, click Import
- Success message shows counts (learners, participations)
- Data visible in Supabase dashboard tables
- Dashboard metrics update (TASK03 cards show new counts)
- Importing same file again updates (not duplicates) learners
