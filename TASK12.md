# TASK12 — Learner Responses Unified View

## Phase
Phase 3: Catalog & Core Views

## What to Build
Build the Learner Responses page showing a wide-format table (one row per learner per activity) with toggleable column groups, activity selector, and question legend.

## Reference
- `src/analytics/engine.py` — `unified_learner_responses()`, `get_question_legend()`

## Steps

1. **Response queries** (`lib/queries/responses.ts`):
   - `getUnifiedResponses(activityId?, filters?)` — returns wide-format data: learner info + participation scores + individual question pre/post answers pivoted into columns (Q1_pre, Q1_post, Q2_pre, Q2_post, etc.)
   - `getQuestionLegend(activityId)` — maps column keys (Q1, Q2...) to full question text
   - Filters: employer, activity, search by learner name/email

2. **ColumnGroupToggle component** (`components/ColumnGroupToggle.tsx`):
   - Toggle buttons for column groups: Demographics, Scores, Assessment Questions, Confidence Questions, Evaluation Responses
   - Each toggle shows/hides the corresponding column group in the table
   - All groups on by default

3. **Learner Responses page** (`app/learner-responses/page.tsx`):
   - Activity selector dropdown at top
   - Search bar and employer filter
   - Column group toggles
   - Wide scrollable table with:
     - Fixed left columns: Name, Email, Employer
     - Scrollable columns: pre_score, post_score, score_change, individual question responses
   - Color-coded cells: correct answers green, incorrect red, improved yellow
   - Question legend panel (expandable) showing Q1 → full text mapping
   - Row count indicator

## Files to Create/Modify
- `lib/queries/responses.ts` (new)
- `components/ColumnGroupToggle.tsx` (new)
- `app/learner-responses/page.tsx` (replace stub)

## Browser Verification
- Learner Responses page shows activity selector
- Selecting an activity loads the wide table
- Column toggles show/hide column groups
- Horizontal scroll works for wide tables
- Question legend maps column headers to full text
- Color coding applied to cells
