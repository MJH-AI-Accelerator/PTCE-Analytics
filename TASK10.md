# TASK10 — Cross-Program Question Search

## Phase
Phase 3: Catalog & Core Views

## What to Build
Add "Search Questions" and "Identical Questions" tabs to the Program Catalog page. Port the question search and identical-question detection from the Python catalog module.

## Reference
- `src/analytics/catalog.py` — `search_questions()`, `find_identical_questions()`

## Steps

1. **Extend catalog queries** (`lib/queries/catalog.ts`):
   - `searchQuestions(query: string, filters?)` — full-text search across question_text from all activities; return question text, activity name, question type, category
   - `findIdenticalQuestions()` — find questions with identical text appearing in multiple activities; group by question_text, list activities, show response comparison

2. **Install Fuse.js** (if not already from TASK08):
   - Use for fuzzy question text matching in search

3. **QuestionSearchResults component** (`components/QuestionSearchResults.tsx`):
   - Display search results as cards: question text (highlighted match), activity name, question type, category
   - For identical questions: grouped view showing the shared question text and a table of activities with their respective pre/post scores for that question

4. **Update Program Catalog page** (`app/program-catalog/page.tsx`):
   - Add tabs: "Activities" (existing from TASK09), "Search Questions", "Identical Questions"
   - Search Questions tab: search input + results
   - Identical Questions tab: auto-populated list of cross-activity questions with comparison data

## Files to Modify
- `lib/queries/catalog.ts` (extend)
- `components/QuestionSearchResults.tsx` (new)
- `app/program-catalog/page.tsx` (add tabs)

## Browser Verification
- Program Catalog has 3 tabs
- "Search Questions" finds questions by text across activities
- "Identical Questions" shows grouped questions appearing in 2+ activities
- Clicking an activity name in results navigates or opens detail
