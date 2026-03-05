# TASK14 — Employer Analysis Page

## Phase
Phase 4: Analytics Dashboards

## What to Build
Build the Employer Analysis page with performance ranking table, minimum-learners slider, bar chart, and head-to-head employer comparison with statistical tests.

## Reference
- `src/analytics/engine.py` — `employer_performance()`, `employer_comparison()`

## Steps

1. **Install Recharts:**
   ```bash
   npm install recharts
   ```

2. **Employer analytics** (`lib/analytics/employer.ts`):
   - `employerPerformance(filters?, minLearners?)` — aggregate by employer_normalized: learner count, avg pre_score, avg post_score, avg score_change, avg confidence_change; filter by min learner threshold
   - `employerComparison(employer1, employer2, filters?)` — side-by-side stats for two employers; include t-test p-value for score_change difference (using `simple-statistics` or inline calculation)

3. **BarChart component** (`components/charts/BarChart.tsx`):
   - Reusable Recharts bar chart wrapper
   - Props: data, xKey, yKeys, colors, title
   - Responsive container, tooltip, legend

4. **Employer Analysis page** (`app/(analytics)/employer-analysis/page.tsx`):
   - **Section 1: Performance Ranking**
     - Min-learners slider (default 5)
     - Sortable table: Employer, Learners, Avg Pre, Avg Post, Avg Change, Avg Confidence Change
     - Bar chart showing top N employers by avg score change
   - **Section 2: Head-to-Head Comparison**
     - Two employer selector dropdowns
     - Side-by-side metric cards
     - Statistical significance indicator (p-value, effect size)
   - Respects global filters from TASK13

## Files to Create/Modify
- `lib/analytics/employer.ts` (new)
- `components/charts/BarChart.tsx` (new)
- `app/(analytics)/employer-analysis/page.tsx` (replace stub)

## Browser Verification
- Employer Analysis shows ranking table and bar chart
- Min-learners slider filters employers with few participants
- Head-to-head comparison shows two employers side by side
- Bar chart renders correctly with tooltips
- Global filters affect the data shown
