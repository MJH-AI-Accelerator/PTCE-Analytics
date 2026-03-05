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

## Database Schema (11 tables)
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

## Existing Python Files (porting from)
| Python File | Lines | Purpose |
|---|---|---|
| `src/database/db.py` | 215 | SQLite schema (11 tables + indexes + seed data) |
| `src/analytics/engine.py` | 578 | All analytics functions |
| `src/analytics/catalog.py` | 213 | Activity catalog & question search |
| `src/ingestion/normalizer.py` | 175 | Confidence, score, employer normalization |
| `src/ingestion/column_mapper.py` | 92 | Auto-detect column mappings |
| `src/identity/resolver.py` | 89 | Learner identity resolution |
| `app.py` | 1236 | Streamlit app with 14 pages |
| `config/default.yaml` | 35 | Column mapping config template |

## Task Progress
| Task | Description | Status |
|---|---|---|
| TASK01 | Next.js Project Shell with Layout and Navigation | Not Started |
| TASK02 | Supabase Schema and Database Types | Not Started |
| TASK03 | Dashboard with Summary Metrics (Empty State) | Not Started |
| TASK04 | Stub Pages for All Routes | Not Started |
| TASK05 | File Upload UI and Preview | Not Started |
| TASK06 | Column Mapping and Auto-Detection | Not Started |
| TASK07 | Data Ingestion Pipeline (Server Action) | Not Started |
| TASK08 | Employer Fuzzy Matching | Not Started |
| TASK09 | Program Catalog: Browse and Detail View | Not Started |
| TASK10 | Cross-Program Question Search | Not Started |
| TASK11 | Learner Explorer with Profile View | Not Started |
| TASK12 | Learner Responses Unified View | Not Started |
| TASK13 | Global Sidebar Filters | Not Started |
| TASK14 | Employer Analysis Page | Not Started |
| TASK15 | Temporal Analysis Page | Not Started |
| TASK16 | Participation Depth Analysis Page | Not Started |
| TASK17 | Question and Evaluation Analysis Pages | Not Started |
| TASK18 | Statistical Tests Page | Not Started |
| TASK19 | Dashboard Charts (Full Dashboard) | Not Started |
| TASK20 | Export to Excel and PDF | Not Started |
| TASK21 | Data Sources Page (Connector Status UI) | Not Started |
| TASK22 | Responsive Polish, Loading States, Error Boundaries | Not Started |
