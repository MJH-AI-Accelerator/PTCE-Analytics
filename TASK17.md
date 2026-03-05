# TASK17 — Question and Evaluation Analysis Pages

## Phase
Phase 4: Analytics Dashboards

## What to Build
Build both the Question Analysis and Evaluation Analysis pages with multiple tabs each. Port the question-level, category-level, confidence, and evaluation analytics from engine.py.

## Reference
- `src/analytics/engine.py` — `question_level_analysis()`, `category_level_analysis()`, `confidence_question_analysis()`, `evaluation_analysis()`, `intended_changes_summary()`, `barriers_summary()`

## Steps

1. **Question analytics** (`lib/analytics/questions.ts`):
   - `questionLevelAnalysis(activityId?, filters?)` — per question: question_text, pre_correct%, post_correct%, change, n_responses
   - `categoryLevelAnalysis(filters?)` — aggregate by question_category: avg pre_correct%, avg post_correct%, change
   - `confidenceQuestionAnalysis(activityId?, filters?)` — per confidence question: pre_avg, post_avg, change, distribution

2. **Evaluation analytics** (`lib/analytics/evaluation.ts`):
   - `evaluationAnalysis(activityId?, filters?)` — aggregate eval responses by eval_category and question
   - `practiceProfileSummary(filters?)` — practice_profile responses aggregated
   - `intendedChangesSummary(filters?)` — intended_change responses with frequency counts
   - `barriersSummary(filters?)` — barrier responses with frequency counts

3. **Question Analysis page** (`app/(analytics)/question-analysis/page.tsx`):
   - **Tab 1: Per-Question** — activity selector, table of questions with pre/post correct %, bar chart
   - **Tab 2: By Category** — grouped by question_category, table + chart
   - **Tab 3: Confidence Questions** — confidence questions with pre/post avg, Likert distribution

4. **Evaluation Analysis page** (`app/(analytics)/evaluation-analysis/page.tsx`):
   - **Tab 1: Practice Profile** — aggregated practice profile responses
   - **Tab 2: Intended Changes** — ranked list of intended changes with frequency
   - **Tab 3: Barriers** — ranked list of barriers with frequency
   - **Tab 4: All Responses** — raw evaluation responses table with filters

## Files to Create/Modify
- `lib/analytics/questions.ts` (new)
- `lib/analytics/evaluation.ts` (new)
- `app/(analytics)/question-analysis/page.tsx` (replace stub)
- `app/(analytics)/evaluation-analysis/page.tsx` (replace stub)

## Browser Verification
- Question Analysis has 3 tabs, each with table and chart
- Evaluation Analysis has 4 tabs
- Activity selector filters data per activity
- Global filters affect results
- Empty states shown when no data
