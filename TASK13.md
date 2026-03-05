# TASK13 — Global Sidebar Filters

## Phase
Phase 4: Analytics Dashboards

## What to Build
Create a reusable FilterPanel component and a shared layout for analytics pages. Filters persist across analytics pages and show matching record counts.

## Steps

1. **Filter queries** (`lib/queries/filters.ts`):
   - `getFilterOptions()` — fetch distinct values for each filter dimension:
     - Employers (from learners.employer_normalized)
     - Therapeutic Areas (from activities.therapeutic_area)
     - Disease States (from activities.disease_state)
     - Years (from activities.activity_date, extracted)
     - Activity Types (from activities.activity_type)
     - Practice Settings (from learners.practice_setting)
   - `getFilteredCount(filters)` — return participation count matching current filters

2. **FilterPanel component** (`components/FilterPanel.tsx`):
   - Multi-select dropdowns for: Employer, Therapeutic Area, Disease State, Practice Setting, Year, Activity Type
   - "Clear All" button
   - Matching count badge: "Showing X of Y participations"
   - Collapsible on mobile
   - "use client" component with state management

3. **Analytics layout** (`app/(analytics)/layout.tsx`):
   - Route group for analytics pages: employer-analysis, temporal-analysis, participation-depth, question-analysis, evaluation-analysis
   - Includes FilterPanel in a top bar or side panel
   - Passes filter state to child pages via URL search params or React context

4. **Move analytics pages into route group:**
   - Move existing stubs/pages for the 5 analytics routes into `app/(analytics)/`

## Files to Create/Modify
- `lib/queries/filters.ts` (new)
- `components/FilterPanel.tsx` (new)
- `app/(analytics)/layout.tsx` (new)
- Move pages into `app/(analytics)/employer-analysis/page.tsx`, etc.

## Browser Verification
- Analytics pages show the FilterPanel
- Dropdowns populated with actual data (or empty if no data)
- Selecting filters updates the matching count
- Filters persist when navigating between analytics pages
- "Clear All" resets all filters
