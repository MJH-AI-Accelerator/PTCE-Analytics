"""Data normalization: employer names, confidence scores, assessments."""

import re
import sqlite3
import pandas as pd
from rapidfuzz import fuzz, process


# --- Confidence Score Normalization ---

DEFAULT_CONFIDENCE_MAP = {
    "not at all confident": 1,
    "somewhat confident": 2,
    "moderately confident": 3,
    "very confident": 4,
    "extremely confident": 5,
}


def normalize_confidence(value, label_map: dict | None = None) -> float | None:
    """Convert a Likert text label to a numeric value (1-5)."""
    if pd.isna(value):
        return None

    label_map = label_map or DEFAULT_CONFIDENCE_MAP

    # If already numeric
    if isinstance(value, (int, float)):
        return float(value) if 1 <= value <= 5 else None

    text = str(value).strip().lower()
    return label_map.get(text)


def normalize_confidence_column(series: pd.Series, label_map: dict | None = None) -> pd.Series:
    return series.apply(lambda v: normalize_confidence(v, label_map))


# --- Assessment Score Normalization ---

def detect_assessment_format(series: pd.Series) -> str:
    """Detect whether a column contains pre-computed scores, correct/incorrect flags, or raw text."""
    sample = series.dropna().head(50)
    if sample.empty:
        return "empty"

    # Check for numeric percentages or fractions
    numeric_count = 0
    for val in sample:
        val_str = str(val).strip()
        if re.match(r"^\d+(\.\d+)?%?$", val_str):
            numeric_count += 1
        elif re.match(r"^\d+/\d+$", val_str):
            numeric_count += 1

    if numeric_count / len(sample) > 0.7:
        return "precomputed"

    # Check for correct/incorrect flags
    flag_values = {"correct", "incorrect", "right", "wrong", "1", "0", "true", "false", "yes", "no"}
    flag_count = sum(1 for v in sample if str(v).strip().lower() in flag_values)
    if flag_count / len(sample) > 0.7:
        return "flags"

    return "raw_text"


def parse_score(value) -> float | None:
    """Parse a pre-computed score into a 0-100 percentage."""
    if pd.isna(value):
        return None

    val_str = str(value).strip()

    # Percentage: "80%" or "80"
    match = re.match(r"^(\d+(\.\d+)?)%?$", val_str)
    if match:
        score = float(match.group(1))
        return score if score <= 100 else None

    # Fraction: "4/5"
    match = re.match(r"^(\d+)/(\d+)$", val_str)
    if match:
        num, denom = int(match.group(1)), int(match.group(2))
        if denom > 0:
            return (num / denom) * 100

    return None


def score_from_flags(flags: list) -> float | None:
    """Compute a percentage score from a list of correct/incorrect flags."""
    correct_values = {"correct", "right", "1", "true", "yes"}
    total = 0
    correct = 0
    for f in flags:
        if pd.isna(f):
            continue
        total += 1
        if str(f).strip().lower() in correct_values:
            correct += 1
    if total == 0:
        return None
    return (correct / total) * 100


# --- Employer Name Normalization ---

def clean_employer_name(name: str) -> str:
    """Basic rule-based cleaning of employer names."""
    if pd.isna(name) or not name:
        return ""
    name = str(name).strip()
    name = re.sub(r"\s+", " ", name)  # collapse whitespace
    name = re.sub(r"[''`]", "'", name)  # normalize apostrophes
    return name


def normalize_employer(raw_name: str, alias_table: dict, threshold: int = 70) -> tuple[str, str, float]:
    """Normalize an employer name using alias table + fuzzy matching.

    Returns: (normalized_name, match_method, confidence_score)
    """
    cleaned = clean_employer_name(raw_name)
    if not cleaned:
        return ("", "empty", 0.0)

    cleaned_lower = cleaned.lower()

    # Exact match in alias table
    if cleaned_lower in alias_table:
        return (alias_table[cleaned_lower], "alias_exact", 1.0)

    # Fuzzy match against alias keys (raw name variations)
    alias_keys = list(alias_table.keys())
    if alias_keys:
        result = process.extractOne(cleaned_lower, alias_keys, scorer=fuzz.WRatio)
        if result and result[1] >= threshold:
            return (alias_table[result[0]], "fuzzy_alias", result[1] / 100.0)

    # Fuzzy match against canonical names
    canonical_names = list(set(alias_table.values()))
    if canonical_names:
        result = process.extractOne(cleaned, canonical_names, scorer=fuzz.WRatio)
        if result and result[1] >= threshold:
            return (result[0], "fuzzy_canonical", result[1] / 100.0)

    # No match — return cleaned name for manual review
    return (cleaned, "unmatched", 0.0)


def build_alias_table_from_db(conn: sqlite3.Connection) -> dict:
    """Load the employer alias table from the database."""
    cursor = conn.execute("SELECT raw_name, canonical_name FROM employer_aliases")
    return {row[0].lower(): row[1] for row in cursor.fetchall()}


def save_alias(conn: sqlite3.Connection, raw_name: str, canonical_name: str,
               method: str = "manual", confidence: float = 1.0):
    """Save an employer alias to the database."""
    conn.execute(
        """INSERT OR REPLACE INTO employer_aliases
           (raw_name, canonical_name, match_method, confidence, reviewed)
           VALUES (?, ?, ?, ?, 1)""",
        (raw_name.lower().strip(), canonical_name, method, confidence),
    )
    conn.commit()


def log_normalization(conn: sqlite3.Connection, field: str, original: str, normalized: str, method: str):
    """Log a normalization decision."""
    conn.execute(
        "INSERT INTO normalization_log (field_name, original_value, normalized_value, method) VALUES (?, ?, ?, ?)",
        (field, original, normalized, method),
    )
