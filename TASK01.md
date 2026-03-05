# TASK01 — Next.js Project Shell with Layout and Navigation

## Phase
Phase 1: Project Foundation

## What to Build
Initialize the Next.js 14 project with TypeScript, Tailwind CSS, and App Router. Remove existing Python files. Create the root layout with a sidebar navigation listing all pages, and a dashboard placeholder.

## Steps

1. **Remove Python files** — delete `app.py`, `requirements.txt`, `refresh_scheduler.py`, `src/`, `tests/`, `config/`, `data/` directories. Keep `README.md`, `PRD.md`, and any `.md` task files.

2. **Initialize Next.js project** in the repo root:
   ```bash
   npx create-next-app@14 . --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*" --use-npm
   ```

3. **Install dependencies:**
   ```bash
   npm install @supabase/supabase-js lucide-react
   ```

4. **Create Sidebar component** (`components/Sidebar.tsx`):
   - App title: "PTCE Analytics"
   - Nav links for all 14 pages with icons from `lucide-react`:
     - Dashboard (`/`)
     - Data Import (`/data-import`)
     - Program Catalog (`/program-catalog`)
     - Question Analysis (`/question-analysis`)
     - Evaluation Analysis (`/evaluation-analysis`)
     - Learner Responses (`/learner-responses`)
     - Employer Analysis (`/employer-analysis`)
     - Temporal Analysis (`/temporal-analysis`)
     - Participation Depth (`/participation-depth`)
     - Learner Explorer (`/learner-explorer`)
     - Employer Management (`/employer-management`)
     - Statistical Tests (`/statistical-tests`)
     - Export (`/export`)
     - Data Sources (`/data-sources`)
   - Use `next/link` and `next/navigation` for active link highlighting
   - Tailwind styling: fixed left sidebar, dark background, white text

5. **Root layout** (`app/layout.tsx`):
   - Include Sidebar, main content area with padding
   - Global styles in `app/globals.css`

6. **Dashboard page** (`app/page.tsx`):
   - Show heading "PTCE Learner Analytics Dashboard"
   - Subtitle: "Welcome to the PTCE Learner Data Longitudinal Analysis Platform"

## Files to Create/Modify
- `package.json` (generated + deps added)
- `tailwind.config.ts`
- `app/globals.css`
- `app/layout.tsx`
- `app/page.tsx`
- `components/Sidebar.tsx`
- `tsconfig.json` (generated)
- `next.config.js` (generated)

## Files to Delete
- `app.py`
- `requirements.txt`
- `refresh_scheduler.py`
- `src/` (entire directory)
- `tests/` (entire directory)
- `config/` (entire directory)
- `data/` (entire directory)

## Browser Verification
- `http://localhost:3000` shows "PTCE Learner Analytics Dashboard" heading
- Left sidebar visible with all 14 nav links
- Clicking nav links changes URL (pages will 404 until TASK04)
- No console errors
