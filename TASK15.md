# TASK15 — Temporal Analysis Page

## Phase
Phase 4: Analytics Dashboards

## What to Build
Build the Temporal Analysis page with year-over-year comparison tables and monthly trend line charts.

## Reference
- `src/analytics/engine.py` — `yearly_comparison()`, `monthly_trend()`

## Steps

1. **Temporal analytics** (`lib/analytics/temporal.ts`):
   - `yearlyComparison(filters?)` — aggregate by year (extracted from activity_date or participation_date): participant count, avg pre_score, avg post_score, avg score_change, avg confidence_change
   - `monthlyTrend(filters?, metric?)` — monthly time series for a chosen metric (score_change, confidence_change, participation_count); return `{ month: string, value: number }[]`

2. **LineChart component** (`components/charts/LineChart.tsx`):
   - Reusable Recharts line chart wrapper
   - Props: data, xKey, yKeys, colors, title
   - Responsive container, tooltip, legend, grid lines

3. **Temporal Analysis page** (`app/(analytics)/temporal-analysis/page.tsx`):
   - **Section 1: Year-over-Year Comparison**
     - Table: Year, Participants, Avg Pre Score, Avg Post Score, Avg Change, Avg Confidence Change
     - Highlight best/worst years
     - Bar chart (grouped bars for pre/post by year)
   - **Section 2: Monthly Trends**
     - Metric selector: Score Change, Confidence Change, Participation Count
     - Line chart showing monthly values
     - Optional year filter to show specific year(s)
   - Respects global filters from TASK13

## Files to Create/Modify
- `lib/analytics/temporal.ts` (new)
- `components/charts/LineChart.tsx` (new)
- `app/(analytics)/temporal-analysis/page.tsx` (replace stub)

## Browser Verification
- Year-over-year table shows data grouped by year
- Monthly trend line chart renders with selected metric
- Metric selector switches the chart data
- Global filters affect results
