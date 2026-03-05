# TASK02 — Supabase Schema and Database Types

## Phase
Phase 1: Project Foundation

## What to Build
Create a Supabase migration file translating the existing SQLite schema (11 tables) to PostgreSQL. Generate TypeScript type definitions for all tables. Create a Supabase client utility.

## Steps

1. **Create migration file** (`supabase/migrations/001_initial_schema.sql`):
   Translate the SQLite schema from `src/database/db.py` to PostgreSQL:

   Tables to create (with proper Postgres types):
   - `learners` — `id BIGSERIAL`, email (UNIQUE NOT NULL), first_name, last_name, employer_raw, employer_normalized, practice_setting, role, created_at/updated_at (TIMESTAMPTZ DEFAULT NOW())
   - `activities` — `activity_id TEXT PRIMARY KEY`, activity_name, activity_type, activity_date, therapeutic_area, disease_state, sponsor, accreditation_type, credit_hours (NUMERIC), target_audience, description, created_at
   - `learning_objectives` — `id BIGSERIAL`, activity_id (FK), objective_number INT, objective_text TEXT NOT NULL
   - `questions` — `id BIGSERIAL`, activity_id (FK), question_number INT, question_text TEXT NOT NULL, question_type TEXT CHECK (assessment/confidence/evaluation/pulse), question_category, correct_answer, objective_id (FK)
   - `question_categories` — `id BIGSERIAL`, category_name TEXT UNIQUE NOT NULL, description
   - `participations` — `id BIGSERIAL`, learner_id (FK), activity_id (FK), participation_date, pre_score, post_score, score_change, pre_confidence_avg, post_confidence_avg, confidence_change, comments, created_at; UNIQUE(learner_id, activity_id)
   - `question_responses` — `id BIGSERIAL`, participation_id (FK), question_id (FK), phase TEXT CHECK (pre/post), learner_answer, is_correct BOOLEAN, numeric_value NUMERIC
   - `evaluation_responses` — `id BIGSERIAL`, participation_id (FK), question_id (FK nullable), eval_question_text, eval_category CHECK (practice_profile/intended_change/barrier/demographic/custom), response_text, response_numeric
   - `evaluation_templates` — `id BIGSERIAL`, question_text, eval_category, response_type CHECK (text/single_select/multi_select/percentage/free_text), is_standard BOOLEAN DEFAULT TRUE
   - `employer_aliases` — `id BIGSERIAL`, raw_name TEXT UNIQUE NOT NULL, canonical_name TEXT NOT NULL, match_method, confidence NUMERIC, reviewed BOOLEAN DEFAULT FALSE, created_at
   - `normalization_log` — `id BIGSERIAL`, field_name, original_value, normalized_value, method, created_at
   - `role_data` — `id BIGSERIAL`, participation_id (FK), role_field, role_value, role_percentage NUMERIC

   Include indexes matching the SQLite schema. Seed question_categories and evaluation_templates.

2. **TypeScript types** (`lib/database.types.ts`):
   - Export `Database` type with `public` schema containing all table Row/Insert/Update types
   - Export individual table types: `Learner`, `Activity`, `Participation`, `Question`, `QuestionResponse`, `EvaluationResponse`, `EmployerAlias`, etc.

3. **Supabase client** (`lib/supabase.ts`):
   - Server-side client using `createClient` with service role key
   - Client-side client using `createClient` with anon key
   - Import `Database` type for type safety

4. **Environment variables** (`.env.local`):
   ```
   NEXT_PUBLIC_SUPABASE_URL=your-project-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```
   Add `.env.local` to `.gitignore` if not already there.

## Files to Create
- `supabase/migrations/001_initial_schema.sql`
- `lib/database.types.ts`
- `lib/supabase.ts`
- `.env.local` (template, gitignored)
- `.env.example` (committed, with placeholder values)

## Browser Verification
- Run migration via Supabase dashboard or CLI: all 11 tables + role_data visible
- App still loads at localhost:3000 without errors
- `lib/supabase.ts` imports cleanly (no TS errors)
