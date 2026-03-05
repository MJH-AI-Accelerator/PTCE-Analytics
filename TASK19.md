# TASK19 — Dashboard Charts (Full Dashboard)

## Phase
Phase 5: Advanced Features

## What to Build
Enhance the dashboard with live charts: score distribution histogram, confidence change histogram, year-over-year bar chart, and top employers. Wire everything to live Supabase data with global filters.

## Steps

1. **Histogram component** (`components/charts/Histogram.tsx`):
   - Recharts-based histogram (use BarChart with binned data)
   - Props: data, binCount, title, xLabel, yLabel
   - Auto-bin numeric data into ranges

2. **DashboardCharts component** (`components/DashboardCharts.tsx`):
   - 2x2 grid of charts:
     - Score Change Distribution (histogram)
     - Confidence Change Distribution (histogram)
     - Year-over-Year Avg Score Change (bar chart, reuse from TASK14)
     - Top 10 Employers by Avg Score Change (horizontal bar chart)
   - Each chart fetches its own data or receives props

3. **Update Dashboard page** (`app/page.tsx`):
   - Keep MetricCards from TASK03
   - Add DashboardCharts below metrics
   - Add FilterPanel (simplified version or reuse from TASK13) for dashboard-level filtering
   - Show "Import data to see charts" message when database is empty

## Files to Create/Modify
- `components/charts/Histogram.tsx` (new)
- `components/DashboardCharts.tsx` (new)
- `app/page.tsx` (modify)

## Browser Verification
- Dashboard shows 4 metric cards + 4 charts
- Charts populated with actual data (or empty state message)
- Histograms show correct distributions
- Year-over-year and employer charts render correctly
- Filters (if added) update all charts
