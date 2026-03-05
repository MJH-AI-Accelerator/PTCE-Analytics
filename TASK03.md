# TASK03 — Dashboard with Summary Metrics (Empty State)

## Phase
Phase 1: Project Foundation

## What to Build
Wire up the dashboard page to query Supabase for summary counts and display them in metric cards. Handle the empty-database state gracefully.

## Steps

1. **Dashboard queries** (`lib/queries/dashboard.ts`):
   - `getDashboardMetrics()` — returns:
     - Total learners count (from `learners`)
     - Total participations count (from `participations`)
     - Total activities count (from `activities`)
     - Average score change (from `participations` where score_change is not null)
   - Use the Supabase server client

2. **MetricCard component** (`components/MetricCard.tsx`):
   - Props: `title`, `value`, `subtitle?`, `icon?` (LucideIcon)
   - Tailwind card styling: white background, shadow, rounded, padding
   - Display value prominently, title above, subtitle below
   - Handle null/zero gracefully (show "N/A" or "0")

3. **Update Dashboard page** (`app/page.tsx`):
   - Server component that calls `getDashboardMetrics()`
   - Render 4 MetricCards in a grid:
     - Total Learners (Users icon)
     - Total Participations (BookOpen icon)
     - Activities Tracked (FolderOpen icon)
     - Avg Score Change (TrendingUp icon)
   - Empty state message when all counts are 0: "No data imported yet. Go to Data Import to get started."
   - Link to `/data-import`

## Files to Create/Modify
- `lib/queries/dashboard.ts` (new)
- `components/MetricCard.tsx` (new)
- `app/page.tsx` (modify)

## Browser Verification
- Dashboard shows 4 metric cards
- All values show 0 or N/A (empty database)
- Empty state message is visible with link to Data Import
- No console errors
