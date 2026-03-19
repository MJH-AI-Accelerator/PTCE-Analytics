# PRD: PTCE Learner Data Longitudinal Analysis Platform

## Context

Pharmacy Times Continuing Education (PTCE) is a leading provider of accredited continuing education for pharmacists, pharmacy technicians, and other healthcare professionals. PTCE delivers education through a mix of formats including CE webinars, online self-study courses, live conferences, and other activity types. These activities generate rich learner performance and engagement data — but currently there is no unified system to longitudinally analyze learner outcomes across activities, employers, time periods, and participation levels. This platform consolidates learner data from multiple sources and provides both descriptive and inferential analytics to support educational outcome measurement, outcomes research, and program improvement.

> **Note:** This platform was originally prototyped in Python/Streamlit with SQLite storage and has been rebuilt as a Next.js 14 web application with Supabase (PostgreSQL) as the data layer. This PRD reflects the current Next.js implementation.

---

## 1. Problem Statement

Pharmacy Times Continuing Education needs to understand how learners (pharmacists, pharmacy technicians, and other healthcare professionals) progress and perform across educational activities over time. Key questions include:
- How do learners from specific employers compare in performance?
- How do outcomes trend year-over-year (e.g., 2024 vs. 2025)?
- What is the impact of participating in multiple activities vs. a single activity?
- How do confidence levels change pre- vs. post-activity?
- What patterns emerge in pulse question responses and learner comments?

There is no existing tool that links learner records across activities for longitudinal tracking.

---

## 2. Target Users

| User Type | Needs |
|---|---|
| **Internal analysts** | Run queries, generate custom reports, access raw data, perform ad-hoc statistical analysis |
| **Non-technical stakeholders** | View dashboards, download pre-built reports (PDF/Excel), filter by employer/year/activity |

---

## 3. Data Model

### 3.1 Data Sources
- **Excel/CSV files**: Exported activity data (primary initial source)
- **External connectors** (future): Snowflake, GlobalMeet, Array, Pigeonhole — connector framework exists with status UI

### 3.2 Core Data Fields

| Field | Description | Type |
|---|---|---|
| Email | Primary learner identifier (may need name as fallback) | String |
| Name (First, Last) | Secondary identifier for deduplication | String |
| Employer | Learner's organization | String |
| Practice Setting | Health-system, community/retail, ambulatory care, managed care, etc. | Categorical |
| Role | Pharmacist, pharmacy technician, student, nurse, etc. | Categorical |
| Activity ID/Name | Which educational activity | String |
| Activity Date | When the activity occurred | Date |
| Activity Type | Webinar, course, conference, etc. | Categorical |
| Therapeutic Area | Primary therapeutic area (e.g., oncology, cardiology, diabetes) | Categorical |
| Disease State | Specific disease state within therapeutic area | Categorical |
| Pre-Activity Assessment | Knowledge assessment before activity (see 3.4) | Mixed |
| Post-Activity Assessment | Knowledge assessment after activity (see 3.4) | Mixed |
| Pre-Activity Confidence | Self-reported confidence before (see 3.5) | Likert text |
| Post-Activity Confidence | Self-reported confidence after (see 3.5) | Likert text |
| Pulse Questions | Short follow-up survey responses | Mixed |
| Comments | Free-text learner feedback | Text |

### 3.3 Activity Metadata

Each activity has its own metadata record, forming a **program catalog** (rolodex of all PTCE programs). This enables users to browse, search, and filter activities before drilling into learner data.

| Field | Description | Type |
|---|---|---|
| Activity ID | Unique identifier for the activity | String |
| Activity Name | Full title of the activity | String |
| Activity Type | Webinar, course, conference, etc. | Categorical |
| Activity Date(s) | Date or date range of the activity | Date |
| Therapeutic Area | Primary therapeutic area (e.g., oncology, cardiology, diabetes) | Categorical |
| Disease State | Specific disease state (e.g., NSCLC, Type 2 Diabetes, Heart Failure) | Categorical |
| Sponsor | Funding/sponsoring organization | String |
| Accreditation Type | ACPE, CME, CNE, etc. | Categorical |
| Credit Hours | Number of CE credits awarded | Numeric |
| Learning Objectives | List of stated learning objectives for the activity | Text (list) |
| Questions to Objectives Mapping | Which assessment questions map to which learning objectives | Structured |
| Target Audience | Intended audience (pharmacists, technicians, nurses, etc.) | Categorical (list) |
| Description | Brief summary of the activity content | Text |

- **FR-ACT-1**: Maintain a searchable activity catalog with all metadata fields above
- **FR-ACT-2**: Map assessment questions to learning objectives per activity, enabling objective-level performance analysis
- **FR-ACT-3**: Allow filtering and browsing activities by therapeutic area, disease state, type, date, sponsor, or audience
- **FR-ACT-4**: Activity detail view showing metadata, linked learner count, and aggregate performance summary
- **FR-ACT-5**: Support importing activity metadata from columns in the data file or the activity information form during upload
- **FR-ACT-6**: **Cross-program question search** — identify and surface assessment questions that are identical (or near-identical) across different activities. This enables:
  - Searching the catalog by question text to find all programs that use a given question
  - Comparing learner performance on the same question across different programs, time periods, and audiences
  - Detecting question reuse patterns (e.g., a standard knowledge-check question used across 5 oncology webinars)
- **FR-ACT-7**: Normalize question text for matching (trim whitespace, normalize punctuation/casing) and use fuzzy matching to also surface near-identical variants (e.g., minor rewording)

### 3.4 Assessment Data Handling

Assessment data format is **TBD** — it may arrive in different forms depending on the activity:

| Possible Format | Description | System Behavior |
|---|---|---|
| **Pre-computed score** | Numeric percentage or fraction (e.g., 80%, 4/5) | Use directly |
| **Raw text answers** | Learner's actual answer text for each question | Requires answer key to score |
| **Correct/Incorrect flags** | Each question already marked right or wrong | Aggregate into a score |

The system must support **all three formats** and detect or be configured per-activity:
- **FR-ASSESS-1**: Auto-detect whether data contains pre-computed scores vs. raw answers
- **FR-ASSESS-2**: Support answer key files/columns to evaluate raw text responses
- **FR-ASSESS-3**: Compute per-learner scores (% correct) from raw question-level data
- **FR-ASSESS-4**: Normalize all assessment data to a common scale for cross-activity comparison

### 3.5 Confidence Score Normalization

Confidence responses arrive as **Likert text** on a 5-point scale:

| Text Label | Numeric Mapping |
|---|---|
| Not at all confident | 1 |
| Somewhat confident | 2 |
| Moderately confident | 3 |
| Very confident | 4 |
| Extremely confident | 5 |

- **FR-CONF-1**: Map Likert text labels to numeric values (1-5) for quantitative analysis
- **FR-CONF-2**: Support configurable label-to-value mapping (in case wording varies across activities)
- **FR-CONF-3**: Calculate confidence change (post minus pre) per learner per activity

### 3.6 Employer Name Normalization

Employer names are **manually entered by learners**, resulting in inconsistent, messy data. Examples of common issues:

| Raw Input | Normalized Name |
|---|---|
| "CVS", "CVS Health", "cvs pharmacy", "CVS Hlth" | CVS Health |
| "Walgreens", "walgreen's", "WALGREENS PHARMACY" | Walgreens |
| "Johns Hopkins", "JHU", "Johns Hopkins Hospital" | Johns Hopkins Health System |

The system must clean and standardize employer names:

- **FR-EMP-1**: Normalize casing, whitespace, and punctuation on all employer inputs
- **FR-EMP-2**: Fuzzy matching — cluster similar employer strings using string similarity algorithms (Levenshtein distance via Fuse.js)
- **FR-EMP-3**: Maintain an **employer alias table** — a curated mapping of known variations to canonical employer names (e.g., "CVS" → "CVS Health")
- **FR-EMP-4**: Surface unmatched/ambiguous employer names for manual review and resolution
- **FR-EMP-5**: Allow analysts to add new aliases and re-run normalization
- **FR-EMP-6**: Log all normalization decisions for auditability (original value → normalized value)

**Approach**: Use a combination of:
1. **Rule-based cleaning** (strip whitespace, lowercase, remove punctuation)
2. **Fuzzy matching** (Fuse.js with Levenshtein distance) to group similar names
3. **Curated alias table** (Supabase `employer_aliases` table) that grows over time as new employer names appear
4. **Manual review queue** for low-confidence matches

### 3.7 Learner Identity Resolution
- **Primary key**: Email address
- **Fallback**: Email + name combination for disambiguation
- **Strategy**: Identity resolution module in the ingestion pipeline that upserts learner records by email

---

## 4. Functional Requirements

### 4.1 Data Ingestion
- **FR-1**: Import learner data from Excel (.xlsx) and CSV files via drag-and-drop upload UI
- **FR-2**: Support configurable column mapping with auto-detection and manual override
- **FR-3**: Validate and normalize incoming data (standardize employer names, confidence scores, assessment scores)
- **FR-4**: Connector interface for future external data sources (Snowflake, GlobalMeet, Array, Pigeonhole)
- **FR-5**: Deduplication and learner identity resolution across data files via email-based upsert

### 4.2 Longitudinal Tracking
- **FR-6**: Link learner records across multiple activities using email (+ name fallback)
- **FR-7**: Build a unified learner profile showing all activities participated in, with timestamps
- **FR-8**: Track learner journeys: sequence of activities, score trajectories, confidence changes

### 4.3 Analytics & Metrics

#### Employer Analysis
- **FR-9**: Aggregate performance metrics (pre/post scores, confidence) by employer
- **FR-10**: Rank employers by average improvement (post minus pre)
- **FR-11**: Compare specific employers head-to-head

#### Temporal Analysis
- **FR-12**: Compare aggregate performance across years (2024 vs. 2025, etc.)
- **FR-13**: Trend analysis: how do metrics change over time within a year?
- **FR-14**: Cohort analysis: learners who started in 2024 vs. 2025

#### Participation Depth Analysis
- **FR-15**: Segment learners by number of activities completed (1, 2-3, 4-5, 6+)
- **FR-16**: Compare outcomes for single-activity vs. multi-activity participants
- **FR-17**: Analyze whether additional activities yield diminishing or compounding returns

#### Practice Setting & Role Analysis
- **FR-18**: Performance breakdown by practice setting
- **FR-19**: Performance breakdown by role within practice settings

#### Learner Filtering & Segmentation
- **FR-20**: Compound filter system supporting AND/OR logic to define learner subsets
- **FR-21**: Filterable dimensions include:
  - Practice setting (e.g., retail, health-system, ambulatory care)
  - Employer (normalized name)
  - Role/responsibility areas (varies by activity — may be single selection, multi-select, or percentage-based)
  - Percentage thresholds on role data (e.g., ">=25% of role involves managing cancer medications")
  - Year/date range of participation
  - Number of activities completed
  - Activity type or specific activity
  - Therapeutic area (e.g., oncology, cardiology, diabetes)
  - Disease state (e.g., NSCLC, heart failure)
- **FR-22**: Role data normalization — since role/responsibility data varies by activity, the system must:
  - Detect the format (single select, multi-select, percentage breakdown)
  - Normalize into a queryable structure (field + value + optional percentage)
  - Allow filtering on any role field regardless of source format
- **FR-23**: Filter preview — show count of matching learners before running full analysis
- **FR-24**: All analytics (employer, temporal, participation, etc.) can be run on any filtered subset

**Example compound filters:**
- `practice_setting = "retail" AND role("cancer medications") >= 25%`
- `employer = "CVS Health" AND year = 2025 AND activities_completed >= 2`
- `(practice_setting = "health-system" OR practice_setting = "ambulatory care") AND post_score > pre_score`

#### Qualitative Analysis
- **FR-25**: Aggregate and categorize pulse question responses
- **FR-26**: Basic sentiment/theme analysis on comments (keyword extraction, categorization)

### 4.4 Statistical Testing
- **FR-27**: Descriptive statistics by default (mean, median, std dev, distributions, counts, 95% CI)
- **FR-28**: Optional inferential tests: paired t-tests with t-statistic, p-value, degrees of freedom, and Cohen's d
- **FR-29**: Report p-values, confidence intervals, and effect sizes when statistical tests are run
- **FR-30**: Flag statistically significant findings automatically with interpretation text

### 4.5 Output & Reporting
- **FR-31**: Interactive web dashboard with filters for employer, year, activity, practice setting
- **FR-32**: Export reports to PDF and Excel — supports full data exports and filtered subsets (learners, questions, employers)
- **FR-33**: Visualization: bar charts, line charts (trends), histograms (distributions) via Recharts
- **FR-34**: Wide-format Learner Responses view with toggleable column groups and color-coded cells

---

## 5. Non-Functional Requirements

- **NFR-1**: Handle 100+ activities and 10K+ learner records efficiently
- **NFR-2**: Data ingestion should validate and report errors clearly (bad rows, missing fields)
- **NFR-3**: Modular architecture: ingestion, identity resolution, analytics, and reporting as separate layers
- **NFR-4**: Extensible: easy to add new metrics, data sources, or output formats
- **NFR-5**: Data privacy: PII (emails, names) is visible to all users in reports and exports — no anonymization required for internal use
- **NFR-6**: Responsive design: usable on desktop (1280px+), tablet (768px), and mobile (375px)
- **NFR-7**: Error boundaries and loading states on all data-fetching pages

---

## 6. Technology Stack

| Component | Technology |
|---|---|
| Framework | Next.js 14 (App Router), TypeScript |
| Database | Supabase (PostgreSQL) |
| Styling | Tailwind CSS |
| Charts | Recharts |
| Auth | Supabase Auth (future) |
| Deployment | Vercel |
| File parsing | SheetJS (xlsx) |
| Fuzzy matching | Fuse.js |
| Statistics | simple-statistics |
| PDF export | jsPDF + jspdf-autotable |
| Excel export | SheetJS (xlsx) |
| Icons | lucide-react |

---

## 7. Architecture Overview

```
[Data Sources]          [Ingestion Layer]        [Supabase (PostgreSQL)]
Excel/CSV files  --->   File Parser (SheetJS) -> learners
                        Column Mapper             activities
                        Normalizer                 learning_objectives
                        Identity Resolver          questions / question_categories
                                                   participations
                                                   question_responses
[External Connectors]                              evaluation_responses
Snowflake        --->   Connector Interface        evaluation_templates
GlobalMeet       --->   (future)                   employer_aliases
Array            --->                              normalization_log
Pigeonhole       --->                              role_data

[Query Layer]           [Next.js App Router]
lib/queries/     --->   14 Pages (Server Components)
lib/analytics/          Client Components (Recharts, filters, panels)
                        Server Actions (data ingestion)

[Export Layer]
lib/export/      --->   Excel (SheetJS) + PDF (jsPDF)
```

### Database Schema (12 tables)
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

---

## 8. Pages (14 routes)

| # | Route | Purpose | Status |
|---|---|---|---|
| 1 | `/` | Dashboard with summary metrics and charts | Metrics complete, charts partial |
| 2 | `/data-import` | File upload, column mapping, ingestion pipeline | Complete |
| 3 | `/program-catalog` | Activity catalog, question search, identical questions | Complete |
| 4 | `/question-analysis` | Per-question stats, category analysis, confidence | Complete |
| 5 | `/evaluation-analysis` | Practice profile, intended changes, barriers | Complete |
| 6 | `/learner-responses` | Wide-format unified view with column toggles | Complete |
| 7 | `/employer-analysis` | Performance ranking, bar chart | Complete |
| 8 | `/temporal-analysis` | Year-over-year, monthly trends | Complete |
| 9 | `/participation-depth` | Segment by activity count, practice setting breakdown | Complete |
| 10 | `/learner-explorer` | Search learners, profile panel | Complete |
| 11 | `/employer-management` | Alias table, unmatched names, normalization log | Complete |
| 12 | `/statistical-tests` | Descriptive stats, paired t-test | Complete |
| 13 | `/export` | Excel and PDF export with type selection | Complete |
| 14 | `/data-sources` | Connector status UI | Complete (UI only) |

---

## 9. Implementation Status

### Completed
- **Project foundation**: Next.js 14 shell, Tailwind CSS, sidebar navigation, layout
- **Database**: Full Supabase PostgreSQL migration (12 tables), TypeScript types, client utilities
- **Data ingestion**: File upload (drag-and-drop), column auto-detection and mapping, full server action pipeline with identity resolution, score/confidence normalization
- **Employer management**: Fuzzy matching (Fuse.js/Levenshtein), alias table, unmatched names queue, normalization log
- **Program catalog**: Searchable activity table, detail panel, cross-program question search, identical question detection
- **Learner views**: Explorer with search/pagination/profile panel, wide-format unified responses with column group toggles
- **Analytics pages**: Question analysis, evaluation analysis, employer analysis, temporal analysis, participation depth
- **Statistical tests**: Descriptive statistics, paired t-test with interpretation
- **Export**: Excel (multi-sheet) and PDF export
- **Data sources**: Connector status UI for 4 external sources
- **UI polish**: Loading skeletons, error boundaries, toast notifications, responsive sidebar

### Remaining Work

| Task | Description | Priority |
|---|---|---|
| Global sidebar filters | Shared filter state (activity, date range, employer, practice setting) that propagates across all analytics pages | High |
| Dashboard charts | Full chart implementation (score distribution, confidence change, year-over-year, top employers) | High |
| Supabase Auth | Authentication and role-based access control | Medium |
| Server-side pagination | Pagination at the query layer for large datasets | Medium |
| Connector implementations | Actual Snowflake, GlobalMeet, Array, Pigeonhole data fetching (framework exists) | Medium |
| ANOVA | Group-by ANOVA analysis with box plots on Statistical Tests page | Medium |
| Qualitative analysis | Pulse question aggregation, comment sentiment/theme analysis | Low |
| Advanced compound filters | AND/OR filter builder with preview counts | Low |
| Test coverage | Unit and integration tests across components and pipelines | Low |
| Performance optimization | Caching, virtual tables for large datasets, optimized re-renders | Low |

---

## 10. Phased Delivery

### Phase 1: Foundation (Complete)
- Next.js 14 project with TypeScript, Tailwind CSS, App Router
- Supabase PostgreSQL schema (12 tables) with migration and seed data
- Dashboard with summary metric cards and empty state handling
- Sidebar navigation with all 14 routes

### Phase 2: Data Ingestion (Complete)
- File upload with drag-and-drop and SheetJS parsing
- Column auto-detection and visual mapping editor
- Server action ingestion pipeline with identity resolution and normalization
- Employer fuzzy matching, alias table, and management UI

### Phase 3: Core Views (Complete)
- Program catalog with activity browser, detail panel, and question search
- Learner explorer with search, pagination, and profile view
- Learner responses wide-format unified view with column group toggles

### Phase 4: Analytics Dashboards (Mostly Complete)
- Question analysis and evaluation analysis pages
- Employer analysis with performance ranking and bar charts
- Temporal analysis with year-over-year and monthly trends
- Participation depth with segmentation and practice setting breakdown
- Statistical tests with descriptive stats and paired t-test
- **Remaining**: Global sidebar filter state, dashboard charts, ANOVA

### Phase 5: Advanced Features (Partially Complete)
- Excel and PDF export (complete)
- Data sources connector status UI (complete)
- Responsive polish, loading states, error boundaries (complete)
- **Remaining**: Auth, server-side pagination, connector implementations, qualitative analysis, advanced filters, test coverage

---

## 11. Key Metrics for Success

- Ability to answer the three core questions (employer performance, year-over-year, single vs. multi-activity)
- Time to generate a report: < 30 seconds for standard analyses
- Data ingestion: successfully import files with varying column layouts with minimal manual configuration
- Learner match rate: > 95% of records successfully linked across activities

---

## 12. Open Questions

1. ~~**Learner identity**: Will email alone be sufficient?~~ **Resolved**: Email is the primary key with name as fallback, implemented in identity resolution module.
2. ~~**Employer normalization**: How many distinct employer names exist?~~ **Resolved**: Fuse.js fuzzy matching with curated alias table, manual review queue for ambiguous names.
3. **Dashboard hosting**: Vercel deployment is planned — configuration and environment variables for production Supabase instance TBD.
4. **Data refresh cadence**: How often will new activity data be ingested? (Ad-hoc upload is supported; scheduled refresh via connectors is future work)
5. **Multi-activity scoring across topics**: When analyzing participation depth, how should we handle learners who completed activities across different therapeutic areas vs. within the same area?
6. **Authentication scope**: What roles and permissions are needed? (Supabase Auth integration is planned but not yet implemented)
7. **Connector credentials**: How will credentials for Snowflake, GlobalMeet, Array, and Pigeonhole be managed in production?
