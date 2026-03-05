# TASK05 — File Upload UI and Preview

## Phase
Phase 2: Data Ingestion

## What to Build
Build the file upload interface for the Data Import page. Support xlsx and csv files, parse them client-side with SheetJS, and show a preview table of the first 10 rows. Include an Activity Information form.

## Steps

1. **Install SheetJS:**
   ```bash
   npm install xlsx
   ```

2. **File parser utility** (`lib/file-parser.ts`):
   - `parseFile(file: File): Promise<{ headers: string[], rows: Record<string, any>[], sheetNames: string[] }>`
   - Support `.xlsx`, `.xls`, `.csv`
   - For multi-sheet workbooks, default to first sheet but allow selection
   - Return parsed headers and row data

3. **FileUploader component** (`components/FileUploader.tsx`):
   - Drag-and-drop zone + click-to-browse
   - Accept `.xlsx`, `.xls`, `.csv` files
   - Show file name, size, row count after parsing
   - Sheet selector dropdown for multi-sheet files
   - "use client" component

4. **DataPreviewTable component** (`components/DataPreviewTable.tsx`):
   - Display first 10 rows in a scrollable table
   - Show all detected column headers
   - Alternating row colors, horizontal scroll for wide tables

5. **Activity Information form** (on Data Import page):
   - Fields: Activity ID, Activity Name, Activity Type (dropdown), Activity Date, Therapeutic Area, Disease State, Sponsor
   - Activity Type options: Webinar, Live Event, Self-Study, Certificate Program, Other
   - Form state managed with React useState

6. **Wire up Data Import page** (`app/data-import/page.tsx`):
   - Step 1: Upload file → shows preview
   - Step 2: Fill in Activity Information
   - Step 3 placeholder: "Column Mapping (TASK06)"
   - Step 4 placeholder: "Import Data (TASK07)"
   - "use client" page

## Files to Create/Modify
- `lib/file-parser.ts` (new)
- `components/FileUploader.tsx` (new)
- `components/DataPreviewTable.tsx` (new)
- `app/data-import/page.tsx` (replace stub)

## Browser Verification
- Navigate to Data Import page
- Drag or select an xlsx/csv file → file metadata displayed
- Preview table shows first 10 rows with all columns
- Activity Information form fields are editable
- No errors on file upload
