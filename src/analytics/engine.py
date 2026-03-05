"""Core analytics engine — employer, temporal, participation, and statistical analysis."""

import pandas as pd
import numpy as np
from scipy import stats as scipy_stats
from src.database.db import get_connection


def get_participation_data(conn=None, filters: dict = None) -> pd.DataFrame:
    """Get the main analysis DataFrame with learner + participation + activity data."""
    if conn is None:
        conn = get_connection()

    query = """
        SELECT
            l.learner_id, l.email, l.first_name, l.last_name,
            l.employer_normalized as employer, l.practice_setting, l.role,
            p.participation_id, p.activity_id, p.participation_date,
            p.pre_score, p.post_score, p.score_change,
            p.pre_confidence_numeric as pre_confidence,
            p.post_confidence_numeric as post_confidence,
            p.confidence_change, p.comments,
            a.activity_name, a.activity_type, a.therapeutic_area,
            a.disease_state, a.sponsor,
            a.credit_hours
        FROM participations p
        JOIN learners l ON p.learner_id = l.learner_id
        JOIN activities a ON p.activity_id = a.activity_id
    """
    df = pd.read_sql_query(query, conn)

    if filters:
        df = apply_filters(df, filters)

    # Add activity count per learner
    activity_counts = df.groupby("learner_id")["activity_id"].nunique().reset_index()
    activity_counts.columns = ["learner_id", "total_activities"]
    df = df.merge(activity_counts, on="learner_id", how="left")

    # Parse dates
    if "participation_date" in df.columns:
        df["participation_date"] = pd.to_datetime(df["participation_date"], errors="coerce")
        df["year"] = df["participation_date"].dt.year

    return df


def apply_filters(df: pd.DataFrame, filters: dict) -> pd.DataFrame:
    """Apply a dict of filters to the DataFrame."""
    if not filters:
        return df

    if "employer" in filters and filters["employer"]:
        df = df[df["employer"].isin(filters["employer"])]
    if "practice_setting" in filters and filters["practice_setting"]:
        df = df[df["practice_setting"].isin(filters["practice_setting"])]
    if "activity_type" in filters and filters["activity_type"]:
        df = df[df["activity_type"].isin(filters["activity_type"])]
    if "therapeutic_area" in filters and filters["therapeutic_area"]:
        df = df[df["therapeutic_area"].isin(filters["therapeutic_area"])]
    if "disease_state" in filters and filters["disease_state"]:
        df = df[df["disease_state"].isin(filters["disease_state"])]
    if "year" in filters and filters["year"]:
        df = df[df["year"].isin(filters["year"])]
    if "activity_id" in filters and filters["activity_id"]:
        df = df[df["activity_id"].isin(filters["activity_id"])]
    if "min_activities" in filters:
        df = df[df["total_activities"] >= filters["min_activities"]]
    if "max_activities" in filters:
        df = df[df["total_activities"] <= filters["max_activities"]]

    return df


# --- Employer Analysis ---

def employer_performance(df: pd.DataFrame, min_learners: int = 5) -> pd.DataFrame:
    """Aggregate performance metrics by employer."""
    grouped = df.groupby("employer").agg(
        learner_count=("learner_id", "nunique"),
        avg_pre_score=("pre_score", "mean"),
        avg_post_score=("post_score", "mean"),
        avg_score_change=("score_change", "mean"),
        avg_pre_confidence=("pre_confidence", "mean"),
        avg_post_confidence=("post_confidence", "mean"),
        avg_confidence_change=("confidence_change", "mean"),
        activity_count=("participation_id", "count"),
    ).reset_index()

    grouped = grouped[grouped["learner_count"] >= min_learners]
    grouped = grouped.sort_values("avg_score_change", ascending=False)
    return grouped.round(2)


def employer_comparison(df: pd.DataFrame, employer_a: str, employer_b: str) -> dict:
    """Head-to-head comparison of two employers."""
    a = df[df["employer"] == employer_a]
    b = df[df["employer"] == employer_b]

    result = {"employer_a": employer_a, "employer_b": employer_b}

    for metric in ["pre_score", "post_score", "score_change", "pre_confidence", "post_confidence", "confidence_change"]:
        a_vals = a[metric].dropna()
        b_vals = b[metric].dropna()
        result[f"{metric}_a_mean"] = a_vals.mean() if len(a_vals) > 0 else None
        result[f"{metric}_b_mean"] = b_vals.mean() if len(b_vals) > 0 else None

        if len(a_vals) >= 2 and len(b_vals) >= 2:
            t_stat, p_val = scipy_stats.ttest_ind(a_vals, b_vals, equal_var=False)
            result[f"{metric}_t_stat"] = round(t_stat, 4)
            result[f"{metric}_p_value"] = round(p_val, 4)
            result[f"{metric}_significant"] = p_val < 0.05

    result["n_a"] = len(a)
    result["n_b"] = len(b)
    return result


# --- Temporal Analysis ---

def yearly_comparison(df: pd.DataFrame) -> pd.DataFrame:
    """Compare performance metrics by year."""
    if "year" not in df.columns:
        return pd.DataFrame()

    grouped = df.groupby("year").agg(
        learner_count=("learner_id", "nunique"),
        avg_pre_score=("pre_score", "mean"),
        avg_post_score=("post_score", "mean"),
        avg_score_change=("score_change", "mean"),
        avg_confidence_change=("confidence_change", "mean"),
        activity_count=("participation_id", "count"),
    ).reset_index()

    return grouped.round(2)


def monthly_trend(df: pd.DataFrame) -> pd.DataFrame:
    """Monthly trend of key metrics."""
    if "participation_date" not in df.columns:
        return pd.DataFrame()

    df_copy = df.copy()
    df_copy["month"] = df_copy["participation_date"].dt.to_period("M").astype(str)

    grouped = df_copy.groupby("month").agg(
        learner_count=("learner_id", "nunique"),
        avg_score_change=("score_change", "mean"),
        avg_confidence_change=("confidence_change", "mean"),
    ).reset_index()

    return grouped.round(2)


# --- Participation Depth Analysis ---

def participation_depth(df: pd.DataFrame) -> pd.DataFrame:
    """Segment learners by number of activities and compare outcomes."""
    learner_summary = df.groupby("learner_id").agg(
        activities_completed=("activity_id", "nunique"),
        avg_pre_score=("pre_score", "mean"),
        avg_post_score=("post_score", "mean"),
        avg_score_change=("score_change", "mean"),
        avg_confidence_change=("confidence_change", "mean"),
    ).reset_index()

    bins = [0, 1, 3, float("inf")]
    labels = ["1 activity", "2-3 activities", "4+ activities"]
    learner_summary["depth_segment"] = pd.cut(
        learner_summary["activities_completed"], bins=bins, labels=labels
    )

    grouped = learner_summary.groupby("depth_segment", observed=True).agg(
        learner_count=("learner_id", "count"),
        avg_activities=("activities_completed", "mean"),
        avg_pre_score=("avg_pre_score", "mean"),
        avg_post_score=("avg_post_score", "mean"),
        avg_score_change=("avg_score_change", "mean"),
        avg_confidence_change=("avg_confidence_change", "mean"),
    ).reset_index()

    return grouped.round(2)


# --- Practice Setting & Role Analysis ---

def practice_setting_breakdown(df: pd.DataFrame) -> pd.DataFrame:
    grouped = df.groupby("practice_setting").agg(
        learner_count=("learner_id", "nunique"),
        avg_score_change=("score_change", "mean"),
        avg_confidence_change=("confidence_change", "mean"),
        avg_post_score=("post_score", "mean"),
    ).reset_index()
    return grouped.sort_values("avg_score_change", ascending=False).round(2)


def role_breakdown(df: pd.DataFrame) -> pd.DataFrame:
    grouped = df.groupby("role").agg(
        learner_count=("learner_id", "nunique"),
        avg_score_change=("score_change", "mean"),
        avg_confidence_change=("confidence_change", "mean"),
        avg_post_score=("post_score", "mean"),
    ).reset_index()
    return grouped.sort_values("avg_score_change", ascending=False).round(2)


# --- Statistical Tests ---

def descriptive_stats(series: pd.Series) -> dict:
    """Compute descriptive statistics for a numeric series."""
    clean = series.dropna()
    if len(clean) == 0:
        return {}
    return {
        "count": len(clean),
        "mean": round(clean.mean(), 2),
        "median": round(clean.median(), 2),
        "std": round(clean.std(), 2),
        "min": round(clean.min(), 2),
        "max": round(clean.max(), 2),
        "q25": round(clean.quantile(0.25), 2),
        "q75": round(clean.quantile(0.75), 2),
    }


def paired_ttest(pre: pd.Series, post: pd.Series) -> dict:
    """Paired t-test for pre vs post scores."""
    mask = pre.notna() & post.notna()
    pre_clean = pre[mask]
    post_clean = post[mask]

    if len(pre_clean) < 2:
        return {"error": "Not enough paired observations"}

    t_stat, p_val = scipy_stats.ttest_rel(pre_clean, post_clean)
    effect_size = (post_clean.mean() - pre_clean.mean()) / pre_clean.std() if pre_clean.std() > 0 else 0

    return {
        "n_pairs": len(pre_clean),
        "pre_mean": round(pre_clean.mean(), 2),
        "post_mean": round(post_clean.mean(), 2),
        "mean_change": round(post_clean.mean() - pre_clean.mean(), 2),
        "t_statistic": round(t_stat, 4),
        "p_value": round(p_val, 4),
        "significant": p_val < 0.05,
        "cohens_d": round(effect_size, 4),
    }


def group_comparison_anova(df: pd.DataFrame, group_col: str, metric_col: str) -> dict:
    """One-way ANOVA comparing a metric across groups."""
    groups = [g[metric_col].dropna().values for _, g in df.groupby(group_col) if len(g[metric_col].dropna()) >= 2]

    if len(groups) < 2:
        return {"error": "Need at least 2 groups with data"}

    f_stat, p_val = scipy_stats.f_oneway(*groups)

    return {
        "n_groups": len(groups),
        "f_statistic": round(f_stat, 4),
        "p_value": round(p_val, 4),
        "significant": p_val < 0.05,
    }
