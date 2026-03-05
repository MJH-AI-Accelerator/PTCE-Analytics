# PRD: PTCE Learner Data Longitudinal Analysis Platform

## Context

Pharmacy Times Continuing Education (PTCE) is a leading provider of accredited continuing education for pharmacists, pharmacy technicians, and other healthcare professionals. PTCE delivers education through a mix of formats including CE webinars, online self-study courses, live conferences, and other activity types. These activities generate rich learner performance and engagement data — but currently there is no unified system to longitudinally analyze learner outcomes across activities, employers, time periods, and participation levels. This program will consolidate learner data from multiple sources and provide both descriptive and inferential analytics to support educational outcome measurement, outcomes research, and program improvement.

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
- **API endpoints**: Programmatic access to PTCE/Pharmacy Times systems (future/supplemental)

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
| Pre-Activity Assessment | Knowledge assessment before activity (see 3.4) | Mixed |
| Post-Activity Assessment | Knowledge assessment after activity (see 3.4) | Mixed |
| Pre-Activity Confidence | Self-reported confidence before (see 3.5) | Likert text |
| Post-Activity Confidence | Self-reported confidence after (see 3.5) | Likert text |
| Pulse Questions | Short follow-up survey responses | Mixed |
| Comments | Free-text learner feedback | Text |

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
- **FR-EMP-2**: Fuzzy matching — cluster similar employer strings using string similarity algorithms (e.g., Levenshtein distance, Jaro-Winkler, or TF-IDF + cosine similarity)
- **FR-EMP-3**: Maintain an **employer alias table** — a curated mapping of known variations to canonical employer names (e.g., "CVS" → "CVS Health")
- **FR-EMP-4**: Surface unmatched/ambiguous employer names for manual review and resolution
- **FR-EMP-5**: Allow analysts to add new aliases and re-run normalization
- **FR-EMP-6**: Log all normalization decisions for auditability (original value → normalized value)

**Approach**: Use a combination of:
1. **Rule-based cleaning** (strip whitespace, lowercase, remove punctuation)
2. **Fuzzy matching** (python-Levenshtein or rapidfuzz library) to group similar names
3. **Curated alias table** (CSV or database table) that grows over time as new employer names appear
4. **Manual review queue** for low-confidence matches

### 3.3 Learner Identity Resolution
- **Primary key**: Email address
- **Fallback**: Email + name combination for disambiguation
- **Strategy**: Build a learner identity resolution module that can be refined as data is explored

---

## 4. Functional Requirements

### 4.1 Data Ingestion
- **FR-1**: Import learner data from Excel (.xlsx) and CSV files
- **FR-2**: Support configurable column mapping (different activities may have different column layouts)
- **FR-3**: Validate and normalize incoming data (standardize employer names, practice settings, etc.)
- **FR-4**: API connector interface for future programmatic data sources
- **FR-5**: Deduplication and learner identity resolution across data files

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
- **FR-15**: Segment learners by number of activities completed (1, 2-3, 4+, etc.)
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
  - Percentage thresholds on role data (e.g., "≥25% of role involves managing cancer medications")
  - Year/date range of participation
  - Number of activities completed
  - Activity type or specific activity
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
- **FR-27**: Descriptive statistics by default (mean, median, std dev, distributions, counts)
- **FR-28**: Optional inferential tests: t-tests, ANOVA, chi-square for group comparisons
- **FR-29**: Report p-values, confidence intervals, and effect sizes when statistical tests are run
- **FR-30**: Flag statistically significant findings automatically

### 4.5 Output & Reporting
- **FR-31**: Interactive dashboard (web-based) with filters for employer, year, activity, practice setting
- **FR-32**: Export reports to PDF and Excel
- **FR-33**: CLI mode for analysts to run specific queries and generate output directly
- **FR-34**: Visualization: bar charts, line charts (trends), box plots (distributions), heatmaps

---

## 5. Non-Functional Requirements

- **NFR-1**: Handle 100+ activities and 10K+ learner records efficiently
- **NFR-2**: Data ingestion should validate and report errors clearly (bad rows, missing fields)
- **NFR-3**: Modular architecture: ingestion, identity resolution, analytics, and reporting as separate layers
- **NFR-4**: Extensible: easy to add new metrics, data sources, or output formats
- **NFR-5**: Data privacy: no PII exposed in shared reports without explicit configuration

---

## 6. Technology Stack

| Component | Technology |
|---|---|
| Language | Python 3.11+ |
| Data processing | pandas, numpy |
| Statistics | scipy, statsmodels |
| Visualization | plotly (interactive), matplotlib (static/PDF) |
| Dashboard | Streamlit or Dash (lightweight web UI) |
| PDF export | reportlab or weasyprint |
| Excel export | openpyxl |
| Data storage | SQLite (local) for unified learner database |
| API ingestion | requests / httpx |
| Fuzzy matching | rapidfuzz (employer name normalization, deduplication) |
| Text analysis | basic NLP with spaCy or simple keyword/regex approach |
| CLI | click or typer |

---

## 7. Architecture Overview

```
[Data Sources]          [Ingestion Layer]        [Core Database]
Excel/CSV files  --->   Column Mapper     --->   SQLite DB
API endpoints    --->   Validator/Normalizer      (unified learner
                        Identity Resolver          profiles)

[Analytics Engine]      [Output Layer]
Employer Analysis  ---> Interactive Dashboard (Streamlit/Dash)
Temporal Analysis  ---> PDF/Excel Reports
Participation      ---> CLI Output
Statistical Tests
Qualitative Analysis
```

---

## 8. Phased Delivery

### Phase 1: Foundation
- Data ingestion from Excel/CSV with configurable column mapping
- Learner identity resolution (email-based)
- SQLite storage with unified learner profiles
- Basic CLI for querying

### Phase 2: Core Analytics
- Employer performance analysis (FR-9 through FR-11)
- Temporal comparison: year-over-year (FR-12 through FR-14)
- Participation depth analysis (FR-15 through FR-17)
- Descriptive statistics and visualizations

### Phase 3: Advanced Analytics & Reporting
- Statistical significance testing (FR-22 through FR-25)
- Practice setting and role breakdowns (FR-18, FR-19)
- PDF and Excel report generation
- Interactive dashboard (Streamlit/Dash)

### Phase 4: Qualitative & Scale
- Pulse question aggregation and analysis
- Comment sentiment/theme analysis
- API data source connectors
- Performance optimization for 100+ activities

---

## 9. Key Metrics for Success

- Ability to answer the three core questions (employer performance, year-over-year, single vs. multi-activity)
- Time to generate a report: < 30 seconds for standard analyses
- Data ingestion: successfully import files with varying column layouts with minimal manual configuration
- Learner match rate: > 95% of records successfully linked across activities

---

## 10. Open Questions

1. **Learner identity**: Will email alone be sufficient, or will we need name-based matching? (To be determined after initial data exploration)
2. **Employer normalization**: How many distinct employer names exist, and how messy is the naming? (May need a mapping/alias table)
3. **Dashboard hosting**: Will the dashboard run locally only, or does it need to be deployed to a server for team access?
4. **Data refresh cadence**: How often will new activity data be ingested? (Ad-hoc vs. scheduled)
