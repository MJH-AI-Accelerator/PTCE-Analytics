const DEFAULT_CONFIDENCE_MAP: Record<string, number> = {
  "not at all confident": 1,
  "somewhat confident": 2,
  "moderately confident": 3,
  "very confident": 4,
  "extremely confident": 5,
};

export function normalizeConfidence(
  value: unknown,
  labelMap?: Record<string, number>
): number | null {
  if (value == null || value === "") return null;
  const map = labelMap ?? DEFAULT_CONFIDENCE_MAP;

  if (typeof value === "number") {
    return value >= 1 && value <= 5 ? value : null;
  }

  const text = String(value).trim().toLowerCase();
  const asNum = parseFloat(text);
  if (!isNaN(asNum) && asNum >= 1 && asNum <= 5) return asNum;

  return map[text] ?? null;
}

export function normalizeScore(value: unknown): number | null {
  if (value == null || value === "") return null;

  const str = String(value).trim();

  // Percentage: "80%" or "80"
  const pctMatch = str.match(/^(\d+(?:\.\d+)?)%?$/);
  if (pctMatch) {
    const score = parseFloat(pctMatch[1]);
    return score <= 100 ? score : null;
  }

  // Fraction: "4/5"
  const fracMatch = str.match(/^(\d+)\/(\d+)$/);
  if (fracMatch) {
    const num = parseInt(fracMatch[1]);
    const denom = parseInt(fracMatch[2]);
    if (denom > 0) return (num / denom) * 100;
  }

  return null;
}

export function normalizeEmployer(raw: string): string {
  if (!raw) return "";
  let name = raw.trim().replace(/\s+/g, " ");
  // Remove common suffixes
  name = name.replace(/\s*,?\s*(Inc\.?|LLC|Corp\.?|Ltd\.?|Co\.?)$/i, "");
  // Title case
  name = name.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  return name;
}
