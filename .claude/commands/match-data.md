# Data Recognition and Matching

You are about to receive a data file (Excel or CSV) for the PTCE Analytics platform. Your job is to identify the data type, validate its structure, extract answer keys, and handle matching/merging with existing data.

## Step 1: Identify the Data Type

Examine the file's columns and content to classify it as one of three types:

### Type 1 — Live Activity Data
**Sources:** Array, GlobalMeet, or Pigeonhole (uploaded manually as Excel/CSV for now)
**Key indicators:** Contains assessment question columns (pre/post), audience response questions, pulse questions, and demographic fields.
**Expected columns include some or all of:**
- Learner email (primary identifier)
- Learner name (first, last)
- Employer (raw text, manually entered by learner)
- Phone number
- Pre-program demographic questions (practice setting, role, etc.)
- Pre-activity assessment questions and learner responses
- Post-activity assessment questions and learner responses
- Audience response / case discussion questions
- Pulse questions (short follow-up survey)

**This data does NOT contain:** Evaluation/satisfaction questions, barriers to practice, intended changes, learning objective satisfaction ratings.

### Type 2 — Live Evaluation Data
**Source:** Snowflake (uploaded manually as Excel/CSV for now)
**Key indicators:** Contains satisfaction ratings, learning objective feedback, practice change intentions, and barriers. No assessment questions.
**Expected columns include some or all of:**
- Learner email (primary identifier — used to match with Type 1)
- Satisfaction with activity (rating scale)
- Satisfaction with faculty (rating scale)
- Whether activity met learning objectives (rating scale)
- Percentage of activity content that was new to them
- Roles/functions involved in their practice setting
- Practice setting
- Intended changes to implement in practice
- Anticipated barriers to implementing changes
- Other evaluation/feedback fields

**This data does NOT contain:** Pre/post assessment questions, audience response questions, pulse questions.

### Type 3 — On-Demand Activity Data
**Source:** Snowflake (uploaded manually as Excel/CSV for now)
**Key indicators:** Contains BOTH assessment data AND evaluation data in a single file. This is a combined format — no merging needed.
**Expected columns include elements from both Type 1 and Type 2:**
- Learner email, name, employer, demographics
- Pre/post assessment questions and responses
- Evaluation questions (satisfaction, barriers, intended changes, etc.)
- May also include confidence questions and pulse questions

## Step 2: Confirm with the User

After identifying the type, tell the user:
1. **What type you identified** and why (list the key columns that led to your classification)
2. **The activity name/ID** if detectable from the data or filename
3. **Row count and column count**
4. **Any issues detected** (missing email column, unexpected format, empty columns)

Ask the user to confirm the type before proceeding.

## Step 3: Extract Answer Key and Score Responses

### Array Reports — Correct Answer Detection
Array Excel files highlight cells where learners answered correctly with background color **#B5E09B**. When processing an Array file:
1. Read cells with `{ cellStyles: true }` to access `fgColor.rgb`
2. For each pre/post assessment column, check if a learner's cell has `fgColor.rgb === "B5E09B"`
3. If highlighted → correct; if not highlighted → incorrect
4. Do NOT rely on the pre-computed "Correct %" column — always derive correctness from cell highlighting

### Survey Assessment Document (Answer Key)
The user will provide a companion `.docx` file (survey assessment document) for each activity. This document contains:
- **Correct answers** (highlighted with #B5E09B in the doc)
- **Rationale** for each correct answer
- **Learning Objective (LO) mapping** — which LO each question maps to
- **Question types** — which questions are pre/post assessment, ARS (no correct answer), pulse (may or may not have correct answers — check the doc), and confidence
- Use this document to validate the correct answers detected from cell highlighting and to extract LO mappings and rationale

### Confidence Scoring
- Map Likert text to numeric: Not at all=1, Somewhat=2, Moderately=3, Very=4, Extremely=5
- **Binary correctness for confidence:** Moderately (3), Very (4), and Extremely (5) = correct; Not at all (1) and Somewhat (2) = incorrect
- Track BOTH the numeric score (1-5) and binary correct/incorrect
- Compute confidence change (post minus pre) as numeric
- If pre or post is unanswered, set confidence change to **null** (do not assume no change)

### Question Categories
Assign each assessment and confidence question to one of these standard categories:
- **Pathophysiology and Mechanism of Action** — disease mechanisms, drug mechanisms, biological pathways
- **Clinical Updates** — new trial data, guideline changes, emerging evidence
- **Patient Recommendations** — treatment selection, counseling, monitoring
- **Disease Burden** — epidemiology, prevalence, impact on patients/systems
- **Role of the Pharmacist** — pharmacist-specific actions, responsibilities, clinical decisions

Use the Learning Objective mapping from the survey assessment document and the question content to determine the appropriate category.

### Sparse Responses
If a learner answered pre but not post (or vice versa), still treat as a **full participation**. Store whatever data is available. Set unanswered fields to null.

## Step 4: Check for Matching Data (Type 1 + Type 2 only)

If the incoming file is **Type 1** or **Type 2**, check the Supabase database for existing data from the complementary type for the same activity:

- **If importing Type 1:** Query for existing evaluation data (Type 2) with matching learner emails. Report how many learners have evaluation data already loaded.
- **If importing Type 2:** Query for existing activity data (Type 1) with matching learner emails. Report how many learners have activity data already loaded.

Report the match status:
- "Found [N] matching learners with [complementary type] data already in the system — these will be linked."
- "No matching [complementary type] data found yet — this data will be stored and matched when the complementary dataset is imported."

## Step 5: Map Columns and Prepare for Import

Based on the identified type:

1. **Auto-detect column mappings** using the existing column mapper (`lib/column-mapper.ts`)
2. **Flag any unmapped columns** that may contain useful data the user should review
3. **Identify the activity** — ask the user for activity metadata if this is a new activity, or confirm the activity if it matches an existing one in the catalog
4. **For Type 1 + Type 2 merging:** The merge happens at the database level via learner email. When both types exist for the same activity:
   - The learner's participation record should contain BOTH assessment scores (from Type 1) AND evaluation responses (from Type 2)
   - The email is the join key — `learners.email` links everything
   - If a learner appears in Type 1 but not Type 2 (or vice versa), their record should still be stored with whatever data is available

### Demographics with "Other" Clarification
When a demographic question has an "Other" option with a clarification text column, combine them as: `Other (clarification text)`. For example, if Position = "Other" and Clarification = "Staff Pharmacist", store as `Other (Staff Pharmacist)`.

## Step 6: Execute Import

Use the existing ingestion pipeline (`lib/ingestion/pipeline.ts`) to:
1. Parse and normalize the data
2. Resolve learner identities (upsert by email)
3. Create/update participation records
4. Store question responses (with correct/incorrect flags derived from #B5E09B highlighting)
5. Store evaluation responses
6. Store question-to-LO mappings and categories
7. Run employer normalization

After import, report:
- Learners created vs updated
- Participations created
- Per-question pre/post correct rates
- Confidence score summary (pre vs post, % correct)
- Match rate with complementary data (if applicable)
- Any rows that failed validation

## Step 7: Presenter Questions (Store for Later)

If the file contains a "Presenter Questions" tab, store these questions separately. They are questions asked by learners during the presentation. These will be aggregated across all activities for future analysis. Do not process them during the main import — just flag their existence and store the raw data.

## Array Report Structure Reference

Array Excel files have a consistent structure:
- **Tabs:** Reportable Participants, Presenter Questions, Survey (main data), Survey Summary
- **Survey tab has a multi-row header** (rows 1-8 before data starts at row 9):
  - Row 1: Generation timestamp
  - Row 2: Activity name
  - Row 3: Top-level column groups (Demographics, Pre/Post, ARS, Pulse)
  - Row 4: Sub-group labels (Demo - Employer, Pre/Post 1, etc.)
  - Row 5: Full question text
  - Row 6: Empty
  - Row 7: Timing indicators (In-Meeting (Pre), In-Meeting (Post))
  - Row 8: Clarification text labels
  - Row 9+: Learner data
- **Fixed columns (B-I):** Registration ID, Email, First Name, Last Name, Display Name, Total responses, Total correct, Correct %
- **Variable columns (J+):** Demographics, Pre/Post questions (paired columns), Confidence (paired), ARS, Pulse

## GlobalMeet Webinar Report Structure Reference

GlobalMeet Excel files are used for PTCE live webinars. They have a variable-width structure:
- **Single sheet** (Sheet0), flat format
- **Rows 1-3:** Metadata (report title, run timestamp, empty row) — skip these
- **Row 4:** Column headers
- **Row 5+:** Learner data
- **Column detection:** MUST detect columns by header text pattern, NOT by fixed position. The number of learner Q&A pairs varies per file, shifting all subsequent columns.
- **Column groups (in order):**
  - Event info: `Event Id`, `Event Title`, `Cost Center`, `Registered On`
  - Learner identity: `First Name`, `Last Name`, `Email`
  - Demographics: `Employer`, `Title`, `Country`, address fields, `Phone Number`, `Mobile Number`, `Fax Number`
  - Pre-program registration questions: `Role`, `Percentage Practice`, `Practice Type`, `Region` — these are demographic questions collected at signup
  - Session tracking: `Live Sessions`, `On-Demand Sessions`, `SimLive Sessions`, `Total Sessions`, `Live Duration`, `On-Demand Duration`, `SimLive Duration`, `Total Duration`
  - Learner questions (presenter Q&A): Columns labeled `Question N` / `Answer N` — **variable count** (0, 2, 3, or more pairs). These are questions learners asked during the webinar. Store separately for future cross-activity aggregation.
  - Pre-test survey: Columns prefixed with `Survey: Pretest Question N:` followed by the question text
  - Post-test survey: Columns prefixed with `Survey: Posttest Question N:` followed by the question text
  - Trailing: `Attendance Results`, `Unsubscribed`
- **Duration filter:** Exclude learners whose `Total Duration` < 2 minutes. Duration is stored as an Excel time fraction (fraction of a day). 2 minutes = 0.001389. Learners under this threshold are not true participants.
- **Multi-broadcast aggregation:** PTCE often broadcasts the same webinar twice (different Event IDs, same program title). When two GlobalMeet files have the same program title, aggregate them into one activity. Deduplicate by email if a learner attended both broadcasts.
- **No cell highlighting:** GlobalMeet files do NOT highlight correct answers with #B5E09B. Always use the survey assessment document for answer keys.
- **ARS/Pulse:** Some GlobalMeet files may include ARS or pulse questions in the survey columns. Detect by header text.
- **Sparse responses:** Learners with demographics but empty survey columns are still full participations (as long as they meet the 2-minute duration threshold).

## Pigeonhole Poll Report Structure Reference

Pigeonhole data comes as **two separate files** per activity — one for pretest, one for posttest. They use a checkbox matrix format.
- **Three tabs per file:** `Poll Results` (aggregate — ignore), `Poll By Users` (individual learner data — USE THIS), `Attendees` (sign-in count — ignore)
- **Poll By Users structure:**
  - Rows 1-4: Metadata ("Pigeonhole Live Poll", event name, poll ID, empty)
  - Row 5: Section labels ("Voters' Attendee Profiles", "Poll Votes")
  - Row 6: Column headers
  - Row 7+: Learner data
- **Identity columns (0-4):** Date/Time, Name, Email, Phone, Employer
- **Checkbox matrix:** Each answer option is its own column, prefixed with `Q{n}: {answer text}`. A `✓` mark indicates the learner selected that option. To reconstruct an answer, scan all columns for a given Q number and find the `✓`.
- **Multi-select questions:** May have multiple `✓` marks per learner (e.g., roles/responsibilities). Store as individual responses.
- **Pretest file contains:** Demographics (variable number of Qs) + assessment questions + pre-confidence
- **Posttest file contains:** Assessment questions (same as pretest, repeated) + post-confidence. No demographics.
- **Merging pre + post:** Join by email. Learners in pretest only → null for post. Learners in posttest only → null for pre and demographics. All are full participations.
- **Distinguishing demographics from assessment:** Column headers alone don't distinguish them. Use the survey assessment document to determine which Q numbers are demographic vs assessment.
- **Correct answers:** Not highlighted in Pigeonhole files. Use the survey assessment document — correct answers may be **bolded** (not highlighted).
- **Detection:** Look for "Pigeonhole Live Poll" in row 1 and `✓` marks in data cells.

## Snowflake Live Credit Evaluation Structure Reference

Snowflake evaluation exports (Type 2) have a consistent structure:
- **Single sheet** (typically named "Sheet 1")
- **Row 1-2:** Metadata rows (question type sort numbers) — always skip these
- **Row 3:** Actual column headers
- **Row 4+:** Learner data
- **Fixed columns (A-G):** Distinct count of email, Date, Activity title, Email, State, Zip code, Employer name
- **Variable columns (H+):** Evaluation questions — these vary per activity but typically include:
  - Educational format rating (Excellent/Good/Average/Poor — keep as text, do NOT convert to numeric)
  - Faculty quality ratings — one column per faculty member. Multi-faculty programs include faculty names in the header (e.g., "Allison Butts, PharmD, BCOP"). Single-faculty programs will NOT have a name — store each as a separate evaluation response tied to the faculty name
  - Learning assessment rating
  - Learning objective achievement ratings (one per LO — store as-is, no need to map to LOs from survey assessment doc)
  - % content that was new
  - Perceived bias (Yes/No) + explanation
  - Practice setting + "if other" explanation
  - Roles/functions (multi-select)
  - Intended changes (multi-select, semicolon-delimited — split and store as individual responses per learner)
  - Anticipated barriers (multi-select, semicolon-delimited — split and store as individual responses per learner)
  - Patient interaction frequency
  - Additional comments (free text)
- **"-" values** mean no response / skipped — treat as null
- **Email (column D)** is the primary key for matching with Type 1 data

## Snowflake On-Demand (Type 3) Structure Reference

On-demand files from Snowflake combine assessment + evaluation + demographics in one file:
- **Same base format as Type 2:** single sheet, rows 1-2 metadata, row 3 headers, row 4+ data
- **Column prefixes identify sections:**
  - `(Pre Test : -)` — pre-test assessment questions + pre-confidence
  - `(Post Test : -)` — post-test assessment questions
  - `(Confidence Question : -)` — post-confidence
  - `(Evaluation : -)` — full evaluation block (same structure as Type 2)
  - `(ARSQuestion : -)` — audience response questions (may contain carryover from other programs — verify relevance with user)
  - `(EnduringSurveyQuestions : -)` — demographics (employer, practice focus, position, etc.) — these come at the END of the file, not the beginning
  - `(Surveyquestions : -)` — pulse questions
- **Row 2 question type sort numbers:** 1=Pre Test, 2=Post Test, 3=Confidence, 4=Evaluation, 5=ARS/Survey/Demographics — consistent across all Type 3 files, useful for auto-detection
- **No cell highlighting (#B5E09B)** — correct answers must come from the survey assessment document. The same answer key applies when the on-demand program corresponds to a live program.
- **Activity distinction:** On-demand versions are stored as **separate activities** from live sessions. Append "(On-Demand)" to the activity name unless the user specifies otherwise. Same program content but different activity records.
- **"-" values** mean no response / skipped — treat as null (same as Type 2)

## Important Notes

- **Email is the primary key** for matching across all data types. If a file lacks an email column, flag this immediately — it cannot be properly matched.
- **Column names vary** between sources (Array vs GlobalMeet vs Pigeonhole vs Snowflake). Use fuzzy matching and ask the user to confirm ambiguous mappings.
- **Future state:** When API connectors are implemented, this matching process should run automatically when new data arrives from any source. The same logic applies — Type 1 and Type 2 are matched by email, Type 3 is self-contained.
- **Pulse questions:** Some have correct answers and some don't. Always check the survey assessment document to determine which pulse questions should be scored.
- **ARS questions:** Never have correct answers — they are audience polling for discussion purposes only.
