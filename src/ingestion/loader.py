"""Data loading and validation for Excel/CSV files."""

import pandas as pd
from pathlib import Path


def load_file(file_path: str | Path) -> pd.DataFrame:
    """Load an Excel or CSV file into a DataFrame."""
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"File not found: {path}")

    if path.suffix.lower() in (".xlsx", ".xls"):
        df = pd.read_excel(path, engine="openpyxl")
    elif path.suffix.lower() == ".csv":
        df = pd.read_csv(path)
    else:
        raise ValueError(f"Unsupported file type: {path.suffix}")

    # Basic cleaning
    df.columns = df.columns.str.strip()
    return df


def load_uploaded_file(uploaded_file) -> pd.DataFrame:
    """Load a Streamlit UploadedFile into a DataFrame."""
    name = uploaded_file.name.lower()
    if name.endswith((".xlsx", ".xls")):
        df = pd.read_excel(uploaded_file, engine="openpyxl")
    elif name.endswith(".csv"):
        df = pd.read_csv(uploaded_file)
    else:
        raise ValueError(f"Unsupported file type: {name}")

    df.columns = df.columns.str.strip()
    return df


def validate_dataframe(df: pd.DataFrame, required_fields: list[str] | None = None) -> dict:
    """Validate a DataFrame and return a report of issues."""
    issues = []
    warnings = []

    if df.empty:
        issues.append("File is empty — no rows found.")
        return {"valid": False, "issues": issues, "warnings": warnings, "row_count": 0}

    if required_fields:
        missing = [f for f in required_fields if f not in df.columns]
        if missing:
            issues.append(f"Missing required columns: {', '.join(missing)}")

    # Check for mostly-empty columns
    for col in df.columns:
        pct_null = df[col].isnull().mean()
        if pct_null > 0.9:
            warnings.append(f"Column '{col}' is {pct_null:.0%} empty")

    # Check for duplicate rows
    dup_count = df.duplicated().sum()
    if dup_count > 0:
        warnings.append(f"{dup_count} duplicate rows found")

    return {
        "valid": len(issues) == 0,
        "issues": issues,
        "warnings": warnings,
        "row_count": len(df),
        "column_count": len(df.columns),
    }
