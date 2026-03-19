# PTCE Analytics — Implementation Context

## Project Overview
The PTCE Learner Data Longitudinal Analysis Platform is being rebuilt from Python/Streamlit to Next.js 14 with TypeScript, Supabase (Postgres), Tailwind CSS, and Vercel deployment.

## Tech Stack
- **Framework:** Next.js 14, App Router, TypeScript
- **Database:** Supabase (PostgreSQL) — migrated from SQLite
- **Styling:** Tailwind CSS
- **Charts:** Recharts
- **Auth:** Supabase Auth (future)
- **Deployment:** Vercel
- **Key Libraries:** `@supabase/supabase-js`, `lucide-react`, `xlsx` (SheetJS), `fuse.js`, `simple-statistics`, `jspdf`, `recharts`

## Database Schema (12 tables)
- `learners` — email (unique), name, employer_raw/normalized, practice_setting, role
- `activities` — activity_id (PK), name, type, date, therapeutic_area, disease_state, sponsor, accreditation_type, credit_hours
- `learning_objectives` — per-activity objectives
- `questions` — assessment/confidence/evaluation/pulse questions per activity
- `question_categories` — standard categories (Pathophysiology, Clinical Updates, Patient Recommendations, Disease Burden, Role of the Pharmacist)
- `participations` — one row per learner per activity with aggregate scores
- `question_responses` — individual pre/post answers per question
- `evaluation_responses` — post-activity survey responses
- `evaluation_templates` — standard evaluation question templates
- `employer_aliases` — raw_name to canonical_name fuzzy mapping
- `normalization_log` — tracks field normalization history
- `role_data` — role percentages per participation

## Pages (12 routes)
1. `/` — Dashboard with summary metrics and charts
2. `/data-import` — File upload, column mapping, ingestion
3. `/program-catalog` — Activity catalog, question search
4. `/question-analysis` — Per-question, by-category, confidence analysis
5. `/evaluation-analysis` — Practice profile, intended changes, barriers
6. `/learner-responses` — Wide-format unified view
7. `/employer-analysis` — Performance ranking, head-to-head comparison
8. `/temporal-analysis` — Year-over-year, monthly trends
9. `/participation-depth` — Segment by activity count
10. `/learner-explorer` — Search learners, profile view
11. `/employer-management` — Alias table, unmatched names
12. `/statistical-tests` — Descriptive stats, t-test, ANOVA
13. `/export` — Excel and PDF export
14. `/data-sources` — Connector status UI

## Python Files (ported from — original source reference)
| Python File | Lines | Purpose | Ported To |
|---|---|---|---|
| `src/database/db.py` | 215 | SQLite schema (11 tables + indexes + seed data) | `supabase/migrations/`, `lib/database.types.ts` |
| `src/analytics/engine.py` | 578 | All analytics functions | `lib/queries/`, `lib/analytics/` |
| `src/analytics/catalog.py` | 213 | Activity catalog & question search | `lib/queries/` |
| `src/ingestion/normalizer.py` | 175 | Confidence, score, employer normalization | `lib/ingestion/` |
| `src/ingestion/column_mapper.py` | 92 | Auto-detect column mappings | `lib/column-mapper.ts` |
| `src/identity/resolver.py` | 89 | Learner identity resolution | `lib/ingestion/pipeline.ts` |
| `app.py` | 1236 | Streamlit app with 14 pages | `app/` (14 route directories) |
| `config/default.yaml` | 35 | Column mapping config template | Activity info form in `/data-import` |

## Task Progress
| Task | Description | Status |
|---|---|---|
| TASK01 | Next.js Project Shell with Layout and Navigation | Complete |
| TASK02 | Supabase Schema and Database Types | Complete |
| TASK03 | Dashboard with Summary Metrics (Empty State) | Complete |
| TASK04 | Stub Pages for All Routes | Complete |
| TASK05 | File Upload UI and Preview | Complete |
| TASK06 | Column Mapping and Auto-Detection | Complete |
| TASK07 | Data Ingestion Pipeline (Server Action) | Complete |
| TASK08 | Employer Fuzzy Matching | Complete |
| TASK09 | Program Catalog: Browse and Detail View | Complete |
| TASK10 | Cross-Program Question Search | Complete |
| TASK11 | Learner Explorer with Profile View | Complete |
| TASK12 | Learner Responses Unified View | Complete |
| TASK13 | Global Sidebar Filters | Not Started |
| TASK14 | Employer Analysis Page | Complete |
| TASK15 | Temporal Analysis Page | Complete |
| TASK16 | Participation Depth Analysis Page | Complete |
| TASK17 | Question and Evaluation Analysis Pages | Complete |
| TASK18 | Statistical Tests Page | Complete (t-test; ANOVA remaining) |
| TASK19 | Dashboard Charts (Full Dashboard) | Partial (metrics done, charts remaining) |
| TASK20 | Export to Excel and PDF | Complete |
| TASK21 | Data Sources Page (Connector Status UI) | Complete (UI only) |
| TASK22 | Responsive Polish, Loading States, Error Boundaries | Complete |

## Remaining Work
| ID | Description | Priority |
|---|---|---|
| NEW-01 | Global sidebar filters — shared filter state across analytics pages | High |
| NEW-02 | Dashboard charts — score distribution, confidence change, YoY, top employers | High |
| NEW-03 | Supabase Auth — authentication and role-based access | Medium |
| NEW-04 | Server-side pagination — query-layer pagination for large datasets | Medium |
| NEW-05 | Connector implementations — actual Snowflake, GlobalMeet, Array, Pigeonhole data fetching | Medium |
| NEW-06 | ANOVA — group-by analysis with box plots on Statistical Tests page | Medium |
| NEW-07 | Qualitative analysis — pulse question aggregation, comment themes | Low |
| NEW-08 | Advanced compound filters — AND/OR filter builder with preview counts | Low |
| NEW-09 | Test coverage — unit and integration tests | Low |
| NEW-10 | Performance optimization — caching, virtual tables, optimized re-renders | Low |
