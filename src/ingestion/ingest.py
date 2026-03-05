"""Main ingestion pipeline — load, map, normalize, and store data."""

import sqlite3
import pandas as pd
from pathlib import Path

from src.ingestion.loader import load_file, load_uploaded_file, validate_dataframe
from src.ingestion.column_mapper import apply_mapping, detect_columns, load_mapping
from src.ingestion.normalizer import (
    normalize_confidence_column,
    normalize_employer,
    build_alias_table_from_db,
    log_normalization,
    parse_score,
    detect_assessment_format,
    score_from_flags,
)
from src.identity.resolver import resolve_learner
from src.database.db import get_connection


def ingest_file(file_path: str | Path = None, uploaded_file=None,
                config_name: str = None, activity_id: str = None,
                db_path: Path = None) -> dict:
    """Full ingestion pipeline for a single data file.

    Returns a summary dict with counts and any issues.
    """
    # Load
    if uploaded_file is not None:
        df = load_uploaded_file(uploaded_file)
        file_label = uploaded_file.name
    elif file_path:
        df = load_file(file_path)
        file_label = str(file_path)
    else:
        raise ValueError("Must provide file_path or uploaded_file")

    # Column mapping
    if config_name:
        mapping = load_mapping(config_name)
        df = apply_mapping(df, mapping)
        confidence_labels = mapping.get("confidence_labels")
    else:
        detected = detect_columns(df)
        rename_map = {v: k for k, v in detected.items()}
        df = df.rename(columns=rename_map)
        confidence_labels = None

    # Validate
    validation = validate_dataframe(df, required_fields=["email"])

    # Connect to DB
    conn = get_connection(db_path) if db_path else get_connection()
    alias_table = build_alias_table_from_db(conn)

    # Normalize confidence columns
    if "pre_confidence" in df.columns:
        df["pre_confidence_numeric"] = normalize_confidence_column(df["pre_confidence"], confidence_labels)
    if "post_confidence" in df.columns:
        df["post_confidence_numeric"] = normalize_confidence_column(df["post_confidence"], confidence_labels)

    # Normalize scores
    for score_col in ["pre_score", "post_score"]:
        if score_col in df.columns:
            fmt = detect_assessment_format(df[score_col])
            if fmt == "precomputed":
                df[score_col] = df[score_col].apply(parse_score)

    # Process each row
    stats = {"rows_processed": 0, "learners_created": 0, "learners_updated": 0,
             "participations_created": 0, "errors": [], "employer_unmatched": []}

    for idx, row in df.iterrows():
        try:
            email = row.get("email")
            if pd.isna(email) or not str(email).strip():
                stats["errors"].append(f"Row {idx}: missing email")
                continue

            # Employer normalization
            employer_raw = str(row.get("employer", "")) if pd.notna(row.get("employer")) else ""
            emp_normalized, emp_method, emp_confidence = normalize_employer(employer_raw, alias_table)
            if emp_method == "unmatched" and employer_raw:
                stats["employer_unmatched"].append(employer_raw)
            if employer_raw and emp_method != "empty":
                log_normalization(conn, "employer", employer_raw, emp_normalized, emp_method)

            # Resolve learner
            learner_id = resolve_learner(
                conn,
                email=str(email).strip(),
                first_name=str(row.get("first_name", "")) if pd.notna(row.get("first_name")) else None,
                last_name=str(row.get("last_name", "")) if pd.notna(row.get("last_name")) else None,
                employer_raw=employer_raw,
                employer_normalized=emp_normalized,
                practice_setting=str(row.get("practice_setting", "")) if pd.notna(row.get("practice_setting")) else None,
                role=str(row.get("role", "")) if pd.notna(row.get("role")) else None,
            )

            # Create participation
            act_id = activity_id or str(row.get("activity_id", "unknown"))
            pre_score = row.get("pre_score") if "pre_score" in df.columns else None
            post_score = row.get("post_score") if "post_score" in df.columns else None
            pre_conf = row.get("pre_confidence_numeric") if "pre_confidence_numeric" in df.columns else None
            post_conf = row.get("post_confidence_numeric") if "post_confidence_numeric" in df.columns else None

            # Calculate changes
            score_change = None
            if pd.notna(pre_score) and pd.notna(post_score):
                score_change = float(post_score) - float(pre_score)

            confidence_change = None
            if pd.notna(pre_conf) and pd.notna(post_conf):
                confidence_change = float(post_conf) - float(pre_conf)

            try:
                conn.execute(
                    """INSERT OR REPLACE INTO participations
                       (learner_id, activity_id, participation_date, pre_score, post_score,
                        pre_confidence_raw, post_confidence_raw,
                        pre_confidence_numeric, post_confidence_numeric,
                        confidence_change, score_change, comments)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (learner_id, act_id,
                     str(row.get("activity_date", "")) if pd.notna(row.get("activity_date")) else None,
                     float(pre_score) if pd.notna(pre_score) else None,
                     float(post_score) if pd.notna(post_score) else None,
                     str(row.get("pre_confidence", "")) if pd.notna(row.get("pre_confidence")) else None,
                     str(row.get("post_confidence", "")) if pd.notna(row.get("post_confidence")) else None,
                     float(pre_conf) if pd.notna(pre_conf) else None,
                     float(post_conf) if pd.notna(post_conf) else None,
                     confidence_change, score_change,
                     str(row.get("comments", "")) if pd.notna(row.get("comments")) else None),
                )
                stats["participations_created"] += 1
            except sqlite3.IntegrityError:
                stats["errors"].append(f"Row {idx}: duplicate participation for learner {email} in {act_id}")

            stats["rows_processed"] += 1

        except Exception as e:
            stats["errors"].append(f"Row {idx}: {str(e)}")

    conn.commit()
    conn.close()

    stats["validation"] = validation
    stats["file"] = file_label
    return stats
