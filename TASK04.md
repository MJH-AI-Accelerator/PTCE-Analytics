# TASK04 — Stub Pages for All Routes

## Phase
Phase 1: Project Foundation

## What to Build
Create stub pages for all 12+ routes so every sidebar link resolves. Each stub shows the page title and a "Coming soon" message. Add active-link styling to the sidebar.

## Steps

1. **Create route directories and page files** — each as a server component with a heading and placeholder text:

   | Route | Directory | Title |
   |---|---|---|
   | `/data-import` | `app/data-import/page.tsx` | Data Import |
   | `/program-catalog` | `app/program-catalog/page.tsx` | Program Catalog |
   | `/question-analysis` | `app/question-analysis/page.tsx` | Question Analysis |
   | `/evaluation-analysis` | `app/evaluation-analysis/page.tsx` | Evaluation Analysis |
   | `/learner-responses` | `app/learner-responses/page.tsx` | Learner Responses |
   | `/employer-analysis` | `app/employer-analysis/page.tsx` | Employer Analysis |
   | `/temporal-analysis` | `app/temporal-analysis/page.tsx` | Temporal Analysis |
   | `/participation-depth` | `app/participation-depth/page.tsx` | Participation Depth |
   | `/learner-explorer` | `app/learner-explorer/page.tsx` | Learner Explorer |
   | `/employer-management` | `app/employer-management/page.tsx` | Employer Management |
   | `/statistical-tests` | `app/statistical-tests/page.tsx` | Statistical Tests |
   | `/export` | `app/export/page.tsx` | Export |
   | `/data-sources` | `app/data-sources/page.tsx` | Data Sources |

2. **Stub page template** — each page:
   ```tsx
   export default function PageName() {
     return (
       <div>
         <h1 className="text-2xl font-bold mb-4">Page Title</h1>
         <p className="text-gray-500">Coming soon.</p>
       </div>
     );
   }
   ```

3. **Update Sidebar** (`components/Sidebar.tsx`):
   - Use `usePathname()` from `next/navigation` to detect active route
   - Highlight active link with different background/text color
   - Mark Sidebar as `"use client"` component

## Files to Create
- `app/data-import/page.tsx`
- `app/program-catalog/page.tsx`
- `app/question-analysis/page.tsx`
- `app/evaluation-analysis/page.tsx`
- `app/learner-responses/page.tsx`
- `app/employer-analysis/page.tsx`
- `app/temporal-analysis/page.tsx`
- `app/participation-depth/page.tsx`
- `app/learner-explorer/page.tsx`
- `app/employer-management/page.tsx`
- `app/statistical-tests/page.tsx`
- `app/export/page.tsx`
- `app/data-sources/page.tsx`

## Files to Modify
- `components/Sidebar.tsx` (add active-link logic)

## Browser Verification
- Every sidebar link navigates to a page showing the correct title
- Active link is visually highlighted in the sidebar
- No 404 errors for any sidebar link
- Browser back/forward works correctly
