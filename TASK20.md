# TASK20 — Export to Excel and PDF

## Phase
Phase 5: Advanced Features

## What to Build
Build the Export page with type selection, Excel export using SheetJS with multiple sheets, and PDF export. Add an export button to the Learner Responses page.

## Reference
- `src/export/reports.py` — `export_to_excel()`

## Steps

1. **Install PDF library:**
   ```bash
   npm install jspdf jspdf-autotable
   ```
   (SheetJS / `xlsx` already installed from TASK05)

2. **Excel export utility** (`lib/export/excel.ts`):
   - `exportToExcel(data: ExportData): Blob` — generate xlsx with multiple sheets:
     - Sheet 1: Summary Metrics
     - Sheet 2: Participation Data (all rows)
     - Sheet 3: Question Responses (wide format)
     - Sheet 4: Evaluation Responses
     - Sheet 5: Employer Performance
   - Accept filters to scope the export
   - Format headers, auto-width columns

3. **PDF export utility** (`lib/export/pdf.ts`):
   - `exportToPDF(data: ExportData): Blob` — generate PDF report:
     - Title page with report date and filter summary
     - Summary metrics table
     - Key charts as embedded images (or table representations)
   - Use `jspdf` + `jspdf-autotable` for tables

4. **Export page** (`app/export/page.tsx`):
   - Export type selector: Full Report, Learner Data, Question Analysis, Employer Analysis
   - Format selector: Excel (.xlsx), PDF
   - Filter summary showing what data will be included
   - "Generate Export" button → download file
   - Progress indicator during generation

5. **Add export button to Learner Responses page:**
   - "Export to Excel" button on `app/learner-responses/page.tsx`
   - Exports current filtered view as xlsx

## Files to Create/Modify
- `lib/export/excel.ts` (new)
- `lib/export/pdf.ts` (new)
- `app/export/page.tsx` (replace stub)
- `app/learner-responses/page.tsx` (modify — add export button)

## Browser Verification
- Export page shows type and format selectors
- Clicking "Generate Export" downloads a file
- Excel file opens with multiple sheets and correct data
- PDF file opens with formatted report
- Learner Responses "Export to Excel" button downloads current view
