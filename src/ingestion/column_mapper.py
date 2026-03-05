"""Configurable column mapping for activity data files."""

import yaml
from pathlib import Path

CONFIG_DIR = Path(__file__).parent.parent.parent / "config"


def load_mapping(config_name: str) -> dict:
    """Load a YAML column mapping config by name."""
    config_path = CONFIG_DIR / f"{config_name}.yaml"
    if not config_path.exists():
        raise FileNotFoundError(f"Column mapping config not found: {config_path}")
    with open(config_path, "r") as f:
        return yaml.safe_load(f)


def apply_mapping(df, mapping: dict):
    """Rename columns in a DataFrame according to the mapping config.

    The mapping config should have a 'columns' key with a dict of
    canonical_name -> source_column_name.
    """
    import pandas as pd

    column_map = mapping.get("columns", {})
    # Invert: source_column -> canonical_name
    rename_map = {v: k for k, v in column_map.items() if v in df.columns}
    df = df.rename(columns=rename_map)
    return df


def detect_columns(df) -> dict:
    """Auto-detect column mapping by matching common patterns."""
    import re

    detected = {}
    col_lower = {c: c.lower().strip() for c in df.columns}

    patterns = {
        "email": r"e[-_]?mail",
        "first_name": r"first[\s_]?name",
        "last_name": r"last[\s_]?name",
        "employer": r"employer|organization|company",
        "practice_setting": r"practice[\s_]?setting|practice[\s_]?type",
        "role": r"^role$|profession|job[\s_]?title",
        "activity_name": r"activity[\s_]?name|program[\s_]?name|course[\s_]?name",
        "activity_id": r"activity[\s_]?id|program[\s_]?id",
        "activity_date": r"activity[\s_]?date|date|completion[\s_]?date",
        "activity_type": r"activity[\s_]?type|format",
        "pre_score": r"pre[\s_-]?(test|assessment|score|quiz)",
        "post_score": r"post[\s_-]?(test|assessment|score|quiz)",
        "pre_confidence": r"pre[\s_-]?confidence",
        "post_confidence": r"post[\s_-]?confidence",
        "comments": r"comment|feedback|open[\s_-]?ended",
        "therapeutic_area": r"therapeutic[\s_]?area|therapy[\s_]?area",
        "disease_state": r"disease[\s_]?state|condition",
    }

    for canonical, pattern in patterns.items():
        for orig_col, lower_col in col_lower.items():
            if re.search(pattern, lower_col):
                detected[canonical] = orig_col
                break

    return detected


def generate_config_template(df, config_name: str):
    """Generate a YAML config template from a DataFrame's columns."""
    detected = detect_columns(df)
    config = {
        "name": config_name,
        "description": f"Column mapping for {config_name}",
        "columns": detected,
        "unmapped_columns": [c for c in df.columns if c not in detected.values()],
        "assessment_format": "auto",
        "confidence_labels": {
            "Not at all confident": 1,
            "Somewhat confident": 2,
            "Moderately confident": 3,
            "Very confident": 4,
            "Extremely confident": 5,
        },
    }

    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    config_path = CONFIG_DIR / f"{config_name}.yaml"
    with open(config_path, "w") as f:
        yaml.dump(config, f, default_flow_style=False, sort_keys=False)

    return config_path
