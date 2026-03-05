# TASK09 — Program Catalog: Browse and Detail View

## Phase
Phase 3: Catalog & Core Views

## What to Build
Build the Program Catalog page with a filterable, searchable activity table and a detail panel showing full activity information.

## Reference
- `src/analytics/catalog.py` — `get_activity_catalog()`, `get_activity_detail()`

## Steps

1. **Catalog queries** (`lib/queries/catalog.ts`):
   - `getActivityCatalog(filters?)` — list all activities with participation count, avg score change, date range
   - `getActivityDetail(activityId)` — full activity record + learning objectives + questions + participation stats
   - Filters: activity_type, therapeutic_area, disease_state, date range, search term

2. **Program Catalog page** (`app/program-catalog/page.tsx`):
   - Search bar (filters activity_name, activity_id)
   - Filter dropdowns: Activity Type, Therapeutic Area, Disease State
   - Results table with columns: Activity ID, Name, Type, Date, Learners, Avg Score Change
   - Sortable columns (click header to sort)
   - Click a row to open detail panel

3. **ActivityDetailPanel component** (`components/ActivityDetailPanel.tsx`):
   - Slide-over or expandable panel showing:
     - All activity metadata fields
     - Learning objectives list
     - Questions list (grouped by type: assessment, confidence, evaluation)
     - Participation summary: total learners, avg pre/post scores, avg score change
   - Close button

## Files to Create/Modify
- `lib/queries/catalog.ts` (new)
- `components/ActivityDetailPanel.tsx` (new)
- `app/program-catalog/page.tsx` (replace stub)

## Browser Verification
- Program Catalog shows activity table (empty state if no data)
- Search filters the table
- Filter dropdowns narrow results
- Clicking a row opens the detail panel with full info
- Sorting works on table columns
