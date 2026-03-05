"""Data refresh manager — orchestrates pulling from all connectors and ingesting into the database."""

import os
import logging
from datetime import datetime, timedelta
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv

from src.database.db import init_db, get_connection
from src.connectors.snowflake_connector import SnowflakeConnector
from src.connectors.globalmeet_connector import GlobalMeetConnector
from src.connectors.array_connector import ArrayConnector
from src.connectors.pigeonhole_connector import PigeonholeConnector
from src.ingestion.normalizer import (
    normalize_confidence_column,
    normalize_employer,
    build_alias_table_from_db,
    log_normalization,
    parse_score,
)
from src.identity.resolver import resolve_learner
from src.analytics.catalog import save_activity

# Load .env from project root
load_dotenv(Path(__file__).parent.parent.parent / ".env")

logger = logging.getLogger("ptce.refresh")

ALL_CONNECTORS = {
    "snowflake": SnowflakeConnector,
    "globalmeet": GlobalMeetConnector,
    "array": ArrayConnector,
    "pigeonhole": PigeonholeConnector,
}


def get_connector(name: str):
    """Get an initialized connector by name."""
    cls = ALL_CONNECTORS.get(name)
    if not cls:
        raise ValueError(f"Unknown connector: {name}. Options: {list(ALL_CONNECTORS.keys())}")
    return cls()


def test_all_connections() -> dict:
    """Test all connector connections. Returns {name: result_dict}."""
    results = {}
    for name, cls in ALL_CONNECTORS.items():
        try:
            connector = cls()
            results[name] = connector.test_connection()
        except Exception as e:
            results[name] = {"success": False, "message": f"Error: {str(e)}"}
    return results


def refresh_from_connector(connector_name: str, since: datetime = None,
                           full_refresh: bool = False) -> dict:
    """Pull data from a single connector and ingest into the database.

    Args:
        connector_name: Name of the connector (snowflake, globalmeet, array, pigeonhole)
        since: Only fetch data updated since this datetime. If None, uses last 24 hours.
        full_refresh: If True, ignore 'since' and pull all data.

    Returns: Summary dict with counts and errors.
    """
    if since is None and not full_refresh:
        since = datetime.now() - timedelta(days=1)

    connector = get_connector(connector_name)
    stats = {
        "connector": connector_name,
        "started_at": datetime.now().isoformat(),
        "activities_fetched": 0,
        "learner_records_fetched": 0,
        "learners_processed": 0,
        "participations_created": 0,
        "errors": [],
    }

    # Test connection first
    test = connector.test_connection()
    if not test["success"]:
        stats["errors"].append(f"Connection failed: {test['message']}")
        return stats

    conn = get_connection()
    alias_table = build_alias_table_from_db(conn)

    try:
        # Fetch and save activities
        activities_df = connector.fetch_activities(since if not full_refresh else None)
        if not activities_df.empty:
            stats["activities_fetched"] = len(activities_df)
            for _, row in activities_df.iterrows():
                save_activity(conn, row.to_dict())

        # Fetch and process learner data
        learner_df = connector.fetch_learner_data(since=since if not full_refresh else None)
        if not learner_df.empty:
            stats["learner_records_fetched"] = len(learner_df)
            _ingest_learner_dataframe(conn, learner_df, alias_table, stats)

    except Exception as e:
        stats["errors"].append(f"Fetch error: {str(e)}")
        logger.exception(f"Error refreshing from {connector_name}")

    stats["finished_at"] = datetime.now().isoformat()
    conn.close()
    return stats


def refresh_all(since: datetime = None, full_refresh: bool = False) -> dict:
    """Pull data from all configured connectors.

    Returns: {connector_name: stats_dict}
    """
    results = {}
    for name in ALL_CONNECTORS:
        try:
            results[name] = refresh_from_connector(name, since, full_refresh)
        except Exception as e:
            results[name] = {"connector": name, "errors": [str(e)]}
    return results


def _ingest_learner_dataframe(conn, df: pd.DataFrame, alias_table: dict, stats: dict):
    """Process a learner DataFrame and insert into the database."""
    # Normalize confidence if present
    if "pre_confidence" in df.columns:
        df["pre_confidence_numeric"] = normalize_confidence_column(df["pre_confidence"])
    if "post_confidence" in df.columns:
        df["post_confidence_numeric"] = normalize_confidence_column(df["post_confidence"])

    # Normalize scores if present
    for col in ["pre_score", "post_score"]:
        if col in df.columns:
            df[col] = df[col].apply(parse_score)

    for idx, row in df.iterrows():
        try:
            email = row.get("email")
            if pd.isna(email) or not str(email).strip():
                stats["errors"].append(f"Row {idx}: missing email")
                continue

            # Employer normalization
            employer_raw = str(row.get("employer", "")) if pd.notna(row.get("employer")) else ""
            emp_normalized, emp_method, _ = normalize_employer(employer_raw, alias_table)
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
            act_id = str(row.get("activity_id", "unknown"))
            pre_score = row.get("pre_score")
            post_score = row.get("post_score")
            pre_conf = row.get("pre_confidence_numeric") if "pre_confidence_numeric" in df.columns else None
            post_conf = row.get("post_confidence_numeric") if "post_confidence_numeric" in df.columns else None

            score_change = None
            if pd.notna(pre_score) and pd.notna(post_score):
                score_change = float(post_score) - float(pre_score)

            confidence_change = None
            if pd.notna(pre_conf) and pd.notna(post_conf):
                confidence_change = float(post_conf) - float(pre_conf)

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
            stats["learners_processed"] += 1

        except Exception as e:
            stats["errors"].append(f"Row {idx}: {str(e)}")

    conn.commit()
