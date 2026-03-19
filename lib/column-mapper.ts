export const CANONICAL_FIELDS = [
  "email",
  "first_name",
  "last_name",
  "employer",
  "practice_setting",
  "role",
  "activity_id",
  "activity_name",
  "activity_date",
  "activity_type",
  "pre_score",
  "post_score",
  "pre_confidence",
  "post_confidence",
  "comments",
  "therapeutic_area",
  "disease_state",
] as const;

export type CanonicalField = (typeof CANONICAL_FIELDS)[number];

const PATTERNS: Record<CanonicalField, RegExp> = {
  email: /e[-_]?mail/i,
  first_name: /first[\s_]?name/i,
  last_name: /last[\s_]?name/i,
  employer: /employer|organization|company/i,
  practice_setting: /practice[\s_]?setting|practice[\s_]?type/i,
  role: /^role$|profession|job[\s_]?title/i,
  activity_name: /activity[\s_]?name|program[\s_]?name|course[\s_]?name/i,
  activity_id: /activity[\s_]?id|program[\s_]?id/i,
  activity_date: /activity[\s_]?date|^date$|completion[\s_]?date/i,
  activity_type: /activity[\s_]?type|^format$/i,
  pre_score: /pre[\s_-]?(test|assessment|score|quiz)/i,
  post_score: /post[\s_-]?(test|assessment|score|quiz)/i,
  pre_confidence: /pre[\s_-]?confidence/i,
  post_confidence: /post[\s_-]?confidence/i,
  comments: /comment|feedback|open[\s_-]?ended/i,
  therapeutic_area: /therapeutic[\s_]?area|therapy[\s_]?area/i,
  disease_state: /disease[\s_]?state|condition/i,
};

export function detectColumns(headers: string[]): Record<string, string | null> {
  const mapping: Record<string, string | null> = {};
  const usedHeaders = new Set<string>();

  for (const canonical of CANONICAL_FIELDS) {
    const pattern = PATTERNS[canonical];
    let matched: string | null = null;
    for (const header of headers) {
      if (usedHeaders.has(header)) continue;
      if (pattern.test(header)) {
        matched = header;
        break;
      }
    }
    if (matched) {
      usedHeaders.add(matched);
    }
    mapping[canonical] = matched;
  }

  return mapping;
}

export function getUnmappedHeaders(
  headers: string[],
  mapping: Record<string, string | null>
): string[] {
  const mappedHeaders = new Set(Object.values(mapping).filter(Boolean));
  return headers.filter((h) => !mappedHeaders.has(h));
}
