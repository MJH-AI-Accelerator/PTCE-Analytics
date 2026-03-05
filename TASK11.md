# TASK11 — Learner Explorer with Profile View

## Phase
Phase 3: Catalog & Core Views

## What to Build
Build the Learner Explorer page with a searchable learner table and a learner profile detail panel showing their complete activity history.

## Reference
- `src/identity/resolver.py` — `get_all_learners_summary()`, `get_learner_profile()`

## Steps

1. **Learner queries** (`lib/queries/learners.ts`):
   - `getLearnersList(search?, filters?)` — paginated list: email, name, employer_normalized, practice_setting, activity count, avg score change
   - `getLearnerProfile(learnerId)` — full learner record + all participations with activity details + question responses + evaluation responses
   - Filters: employer, practice_setting, min activity count

2. **Learner Explorer page** (`app/learner-explorer/page.tsx`):
   - Search bar (searches email, first_name, last_name)
   - Filter dropdowns: Employer, Practice Setting
   - Results table: Name, Email, Employer, Practice Setting, Activities, Avg Score Change
   - Sortable columns
   - Pagination (25 per page)
   - Click row to open profile panel

3. **LearnerProfilePanel component** (`components/LearnerProfilePanel.tsx`):
   - Learner info header: name, email, employer, practice setting, role
   - Activity History table: activity name, date, pre/post scores, score change, confidence change
   - Score trend (if 2+ activities): simple inline sparkline or list showing progression
   - Expandable rows showing individual question responses per activity

## Files to Create/Modify
- `lib/queries/learners.ts` (new)
- `components/LearnerProfilePanel.tsx` (new)
- `app/learner-explorer/page.tsx` (replace stub)

## Browser Verification
- Learner Explorer shows learner table (empty state if no data)
- Search filters by name/email
- Clicking a learner opens profile panel
- Profile shows activity history with scores
- Pagination works
