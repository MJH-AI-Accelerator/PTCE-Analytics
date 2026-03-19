# PTCE Analytics — CLAUDE.md

## Project Overview

Pharmacy Times Continuing Education (PTCE) Learner Data Longitudinal Analysis Platform. Rebuilt from Python/Streamlit to Next.js 14. Tracks learner performance across CE activities (webinars, courses, conferences) with pre/post assessments, confidence scores, employer analysis, and statistical testing.

## Commands

- `npm run dev` — Start dev server
- `npm run build` — Production build
- `npm run start` — Start production server
- `npm run lint` — Run ESLint

## Tech Stack

- **Framework:** Next.js 14 (App Router), TypeScript, React 18
- **Database:** Supabase (PostgreSQL)
- **Styling:** Tailwind CSS 3
- **Charts:** Recharts
- **File parsing:** SheetJS (xlsx)
- **Fuzzy matching:** Fuse.js
- **Statistics:** simple-statistics
- **Export:** jsPDF + jspdf-autotable (PDF), SheetJS (Excel)
- **Icons:** lucide-react
- **Deployment:** Vercel
- **Path alias:** `@/*` maps to project root

## Architecture

```
app/                    # Next.js App Router (14 routes)
components/             # React components (Sidebar, charts, panels, upload UI)
lib/
  queries/              # Supabase data-fetching functions
  analytics/            # Calculation/aggregation logic
  ingestion/            # Import pipeline (normalizer, identity resolver, employer matcher)
  export/               # Excel and PDF generation
  connectors/           # External data source stubs (Snowflake, GlobalMeet, Array, Pigeonhole)
  supabase.ts           # Supabase client
  database.types.ts     # TypeScript types for all DB tables
  file-parser.ts        # CSV/Excel → JSON
  column-mapper.ts      # Auto-detect column mappings
  validators.ts         # Column mapping validation
supabase/migrations/    # PostgreSQL schema (001_initial_schema.sql)
```

## Database Schema (12 tables)

- `learners` — email (unique PK), name, employer_raw/normalized, practice_setting, role
- `activities` — activity_id, name, type, date, therapeutic_area, disease_state, sponsor, accreditation_type, credit_hours
- `learning_objectives` — per-activity objectives
- `questions` — assessment/confidence/evaluation/pulse questions per activity
- `question_categories` — standard categories (Pathophysiology, Clinical Updates, Patient Recommendations, Disease Burden, Role of the Pharmacist)
- `participations` — one row per learner per activity, with aggregate pre/post scores and confidence
- `question_responses` — individual pre/post answers per question per participation
- `evaluation_responses` — post-activity survey responses
- `evaluation_templates` — standard evaluation question templates
- `employer_aliases` — raw_name → canonical_name mapping
- `normalization_log` — audit trail for data transformations
- `role_data` — role percentage breakdown per participation

## Routes (14 pages)

| Route | Purpose | Status |
|---|---|---|
| `/` | Dashboard — summary metrics + charts | Metrics done, charts partial |
| `/data-import` | File upload, column mapping, ingestion pipeline | Complete |
| `/program-catalog` | Activity catalog, question search, identical questions | Complete |
| `/question-analysis` | Per-question stats, category analysis, confidence | Complete |
| `/evaluation-analysis` | Practice profile, intended changes, barriers | Complete |
| `/learner-responses` | Wide-format unified view with column toggles | Complete |
| `/employer-analysis` | Performance ranking, bar chart | Complete |
| `/temporal-analysis` | Year-over-year, monthly trends | Complete |
| `/participation-depth` | Segment by activity count, practice setting breakdown | Complete |
| `/learner-explorer` | Search learners, profile panel | Complete |
| `/employer-management` | Alias table, unmatched names, normalization log | Complete |
| `/statistical-tests` | Descriptive stats, paired t-test | Complete (ANOVA remaining) |
| `/export` | Excel and PDF export | Complete |
| `/data-sources` | Connector status UI | Complete (UI only) |

## Data Flow

1. **Import:** User uploads CSV/Excel → `FileUploader` → `parseFile()` → `detectColumns()` → column mapping UI → `ingestData()` server action
2. **Normalize:** `normalizeScore()` (%, fractions → numeric), `normalizeConfidence()` (Likert text → 1-5), `normalizeEmployer()` (fuzzy match → canonical)
3. **Identity:** `resolveOrCreateLearner()` — upsert by email, name as fallback
4. **Query:** Pages call `lib/queries/*` → Supabase client → render
5. **Analytics:** `lib/analytics/*` — employer stats, temporal trends, participation depth, question analysis, statistics
6. **Export:** `lib/export/excel.ts` / `lib/export/pdf.ts` → browser download

## Implementation Status

### Completed (Tasks 1-12, 14-22)
All 14 pages built. Full ingestion pipeline, employer management, program catalog, learner views, analytics pages, statistical tests, export, data source UI, loading states, error boundaries, toast notifications.

### Remaining Work (Priority Order)

1. **Global sidebar filters** (TASK13 — High) — Shared filter state (activity, date range, employer, practice setting) propagating across all analytics pages. Needs: `FilterPanel` component, filter context/state management, analytics route group layout.
2. **Dashboard charts** (TASK19 partial — High) — Score distribution histogram, confidence change chart, year-over-year bar chart, top employers. Components exist (`DashboardCharts.tsx`, `Histogram.tsx`) but need full wiring.
3. **ANOVA** (Medium) — Group-by ANOVA with box plots on Statistical Tests page.
4. **Supabase Auth** (Medium) — Authentication and role-based access control.
5. **Server-side pagination** (Medium) — Query-layer pagination for large datasets.
6. **Connector implementations** (Medium) — Actual data fetching for Snowflake, GlobalMeet, Array, Pigeonhole (framework/stubs exist).
7. **Qualitative analysis** (Low) — Pulse question aggregation, comment sentiment/theme analysis.
8. **Advanced compound filters** (Low) — AND/OR filter builder with preview counts.
9. **Test coverage** (Low) — Unit and integration tests.
10. **Performance optimization** (Low) — Caching, virtual tables, optimized re-renders.

## Key Conventions

- Server components by default; `'use client'` only when needed (state, effects, browser APIs)
- Data fetching in `lib/queries/` (called from page components)
- Analytics calculations in `lib/analytics/` (separate from queries)
- Supabase client via `lib/supabase.ts` — uses `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Confidence scores: Likert text → 1-5 numeric (Not at all=1, Somewhat=2, Moderately=3, Very=4, Extremely=5)
- Employer normalization: raw input → Fuse.js fuzzy match → `employer_aliases` table → canonical name
- Learner identity: email as primary key, name as fallback for disambiguation
- Assessment formats: pre-computed scores, raw text answers (need answer key), or correct/incorrect flags — system handles all three

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

See `.env.example` for connector credentials (Snowflake, GlobalMeet, Array, Pigeonhole).
