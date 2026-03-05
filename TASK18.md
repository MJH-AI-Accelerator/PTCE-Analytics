# TASK18 — Statistical Tests Page

## Phase
Phase 5: Advanced Features

## What to Build
Build the Statistical Tests page with descriptive statistics, paired t-test, and ANOVA with p-values and effect sizes. Include a box plot component.

## Reference
- `src/analytics/engine.py` — `descriptive_stats()`, `paired_ttest()`, `group_comparison_anova()`

## Steps

1. **Install statistics library:**
   ```bash
   npm install simple-statistics
   ```

2. **Statistics analytics** (`lib/analytics/statistics.ts`):
   - `descriptiveStats(filters?)` — for pre_score, post_score, score_change: mean, median, std dev, min, max, n, 95% CI
   - `pairedTTest(filters?)` — paired t-test on pre_score vs post_score: t-statistic, p-value, degrees of freedom, Cohen's d effect size
   - `groupComparisonANOVA(groupBy: string, filters?)` — one-way ANOVA comparing score_change across groups (employer, practice_setting, activity_type): F-statistic, p-value, eta-squared; post-hoc pairwise comparisons if significant

3. **BoxPlot component** (`components/charts/BoxPlot.tsx`):
   - Recharts-based or custom SVG box plot
   - Show median, Q1, Q3, whiskers, outliers
   - Props: data groups, labels, title

4. **Statistical Tests page** (`app/statistical-tests/page.tsx`):
   - **Section 1: Descriptive Statistics**
     - Table: Metric, N, Mean, Median, Std Dev, Min, Max, 95% CI
     - Box plots for pre_score, post_score, score_change
   - **Section 2: Paired t-Test (Pre vs Post)**
     - Results card: t-statistic, p-value, effect size (Cohen's d)
     - Interpretation text (e.g., "Statistically significant improvement, p < 0.001")
     - Effect size label (small/medium/large)
   - **Section 3: Group Comparison (ANOVA)**
     - Group-by selector: Employer, Practice Setting, Activity Type
     - ANOVA results: F-statistic, p-value, eta-squared
     - Post-hoc comparison table if significant
     - Box plot by group

## Files to Create/Modify
- `lib/analytics/statistics.ts` (new)
- `components/charts/BoxPlot.tsx` (new)
- `app/statistical-tests/page.tsx` (replace stub)

## Browser Verification
- Three sections visible with statistics results
- Descriptive stats table populated with correct values
- t-test shows results with interpretation
- ANOVA group-by selector switches analysis
- Box plots render correctly
- Empty state when insufficient data
