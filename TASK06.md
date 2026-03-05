# TASK06 — Column Mapping and Auto-Detection

## Phase
Phase 2: Data Ingestion

## What to Build
Port the Python `column_mapper.py` auto-detection logic to TypeScript. Build a visual column mapping UI with dropdowns. Support loading mappings from a YAML-like config.

## Reference
- `src/ingestion/column_mapper.py` — `detect_columns()` function that fuzzy-matches file headers to canonical field names

## Steps

1. **Column mapper utility** (`lib/column-mapper.ts`):
   - Define canonical fields (same as `config/default.yaml`):
     ```
     email, first_name, last_name, employer, practice_setting, role,
     activity_id, activity_name, activity_date, activity_type,
     pre_score, post_score, pre_confidence, post_confidence,
     comments, therapeutic_area, disease_state
     ```
   - `detectColumns(headers: string[]): Record<string, string | null>` — auto-map headers to canonical fields using case-insensitive substring matching and common aliases
   - `getUnmappedHeaders(headers: string[], mapping: Record<string, string | null>): string[]`
   - Support for dynamic question columns (Q1_pre, Q1_post, etc.)

2. **Validators** (`lib/validators.ts`):
   - `validateMapping(mapping: Record<string, string | null>): ValidationResult`
   - Required fields: `email` (or `first_name` + `last_name`)
   - Warnings for missing optional fields (scores, confidence, etc.)
   - Return `{ isValid: boolean, errors: string[], warnings: string[] }`

3. **ColumnMappingEditor component** (`components/ColumnMappingEditor.tsx`):
   - Two-column layout: canonical field name ↔ dropdown of file headers
   - Auto-populated from `detectColumns()` results
   - Manual override: user can change any mapping via dropdown
   - Unmapped file columns shown separately (with option to assign as question/evaluation columns)
   - Validation messages (errors in red, warnings in yellow)
   - "Reset to Auto-Detected" button

4. **Integrate into Data Import page** (`app/data-import/page.tsx`):
   - After file upload, run auto-detection and show ColumnMappingEditor
   - Step 3 becomes functional column mapping
   - Show validation status before allowing import

## Files to Create/Modify
- `lib/column-mapper.ts` (new)
- `lib/validators.ts` (new)
- `components/ColumnMappingEditor.tsx` (new)
- `app/data-import/page.tsx` (modify — wire in Step 3)

## Browser Verification
- Upload a file → column mapping auto-populates
- Dropdowns allow changing mappings
- Missing required fields show red errors
- Missing optional fields show yellow warnings
- "Reset to Auto-Detected" restores original mappings
