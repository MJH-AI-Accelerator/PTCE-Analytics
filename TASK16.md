# TASK16 — Participation Depth Analysis Page

## Phase
Phase 4: Analytics Dashboards

## What to Build
Build the Participation Depth page that segments learners by activity count and compares outcomes across segments. Include practice setting and role breakdowns.

## Reference
- `src/analytics/engine.py` — `participation_depth()`, `practice_setting_breakdown()`, `role_breakdown()`

## Steps

1. **Participation analytics** (`lib/analytics/participation.ts`):
   - `participationDepth(filters?)` — segment learners into groups by activity count (1, 2-3, 4+); for each segment: count, avg pre_score, avg post_score, avg score_change, avg confidence_change
   - `practiceSettingBreakdown(filters?)` — aggregate by practice_setting: count, avg scores, avg changes
   - `roleBreakdown(filters?)` — aggregate by role from role_data table: count, avg role_percentage, avg scores

2. **Participation Depth page** (`app/(analytics)/participation-depth/page.tsx`):
   - **Section 1: Depth Segments**
     - Table: Segment (1, 2-3, 4+), Learner Count, Avg Pre, Avg Post, Avg Change
     - Grouped bar chart comparing segments
     - Key insight callout (e.g., "Learners with 4+ activities show X% higher improvement")
   - **Section 2: Practice Setting Breakdown**
     - Table by practice setting with same metrics
     - Horizontal bar chart
   - **Section 3: Role Breakdown**
     - Table by role with counts and avg scores
     - Pie/donut chart showing role distribution
   - Respects global filters from TASK13

## Files to Create/Modify
- `lib/analytics/participation.ts` (new)
- `app/(analytics)/participation-depth/page.tsx` (replace stub)

## Browser Verification
- Three sections visible with tables and charts
- Depth segments correctly bucket learners
- Practice setting and role breakdowns show per-group stats
- Charts render correctly
- Global filters affect results
