# TASK08 — Employer Fuzzy Matching

## Phase
Phase 2: Data Ingestion

## What to Build
Replace Python's `rapidfuzz` with `Fuse.js` for employer name fuzzy matching. Build the Employer Management page with alias table, unmatched names, and normalization log.

## Reference
- `src/ingestion/normalizer.py` — `build_alias_table_from_db()`, `save_alias()`

## Steps

1. **Install Fuse.js:**
   ```bash
   npm install fuse.js
   ```

2. **Employer matcher** (`lib/ingestion/employer-matcher.ts`):
   - `findBestMatch(rawName: string, canonicalNames: string[], threshold?: number): { match: string | null, score: number, method: string }`
   - Use Fuse.js with keys on canonical names, threshold ~0.4
   - Methods: "exact", "fuzzy", "none"
   - `buildAliasTable(supabase): Promise<EmployerAlias[]>` — scan learners table for distinct employer_raw values, match against existing canonical names
   - `applyAlias(supabase, rawName: string, canonicalName: string)` — insert into employer_aliases, update learners

3. **Employer queries** (`lib/queries/employer.ts`):
   - `getEmployerAliases()` — all alias records
   - `getUnmatchedEmployers()` — employer_raw values not in employer_aliases
   - `getCanonicalEmployers()` — distinct employer_normalized values
   - `getNormalizationLog(field?: string)` — from normalization_log table

4. **Employer Management page** (`app/employer-management/page.tsx`):
   - **Tab 1: Alias Table** — sortable table of raw_name → canonical_name, match_method, confidence, reviewed status; edit/delete buttons
   - **Tab 2: Unmatched Names** — list of employer_raw values without aliases; for each, show Fuse.js suggested match + "Accept" / "Assign manually" buttons
   - **Tab 3: Normalization Log** — read-only table of normalization_log entries filtered to employer field
   - Alias creation form: raw name input, canonical name dropdown (or new), save button

## Files to Create/Modify
- `lib/ingestion/employer-matcher.ts` (new)
- `lib/queries/employer.ts` (new)
- `app/employer-management/page.tsx` (replace stub)

## Browser Verification
- Employer Management page shows 3 tabs
- After importing data (TASK07), unmatched employers appear in Tab 2
- Fuse.js suggests matches for similar names
- Accepting a match creates an alias and updates learner records
- Alias Table tab shows all mappings
