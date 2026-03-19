/**
 * Confidence scoring utilities.
 * Likert text → numeric (1-5), binary correctness (≥3 = correct).
 */

const LIKERT_MAP: Record<string, number> = {
  "not at all confident": 1,
  "not at all": 1,
  "somewhat confident": 2,
  "somewhat": 2,
  "moderately confident": 3,
  "moderately": 3,
  "very confident": 4,
  "very": 4,
  "extremely confident": 5,
  "extremely": 5,
};

/** Convert Likert text or numeric string to 1-5 scale. Returns null if unparseable. */
export function likertToNumeric(value: string | null | undefined): number | null {
  if (value == null || value === "" || value === "-") return null;

  // Already numeric
  const num = Number(value);
  if (!isNaN(num) && num >= 1 && num <= 5) return num;

  const normalized = value.trim().toLowerCase();
  return LIKERT_MAP[normalized] ?? null;
}

/** Binary correctness: ≥3 = correct (true), <3 = incorrect (false). Null if no value. */
export function confidenceBinary(numericValue: number | null): boolean | null {
  if (numericValue == null) return null;
  return numericValue >= 3;
}

/** Compute confidence change. Null if either side unanswered. */
export function confidenceChange(pre: number | null, post: number | null): number | null {
  if (pre == null || post == null) return null;
  return post - pre;
}

/** Compute average of non-null values. Returns null if no values. */
export function confidenceAverage(values: (number | null)[]): number | null {
  const valid = values.filter((v): v is number => v != null);
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

/**
 * Score a set of assessment responses.
 * Returns percentage correct (0-100) or null if no scoreable responses.
 */
export function computeAssessmentScore(responses: { isCorrect: boolean | null }[]): number | null {
  const scoreable = responses.filter((r) => r.isCorrect != null);
  if (scoreable.length === 0) return null;
  const correct = scoreable.filter((r) => r.isCorrect === true).length;
  return (correct / scoreable.length) * 100;
}
