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
            p.pre_confidence_avg as pre_confidence,
            p.post_confidence_avg as post_confidence,
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


# --- Per-Question Analysis ---

def question_level_analysis(conn, activity_id: str = None, filters: dict = None) -> pd.DataFrame:
    """Get per-question pre vs post performance.

    Shows for each question: pre % correct, post % correct, improvement, category.
    """
    query = """
        SELECT
            q.question_id, q.question_number, q.question_text, q.question_category,
            q.question_type, q.activity_id, a.activity_name,
            qr.phase, qr.is_correct, qr.numeric_value,
            p.participation_id, p.learner_id
        FROM question_responses qr
        JOIN questions q ON qr.question_id = q.question_id
        JOIN participations p ON qr.participation_id = p.participation_id
        JOIN activities a ON q.activity_id = a.activity_id
    """
    if activity_id:
        query += f" WHERE q.activity_id = '{activity_id}'"

    df = pd.read_sql_query(query, conn)
    if df.empty:
        return pd.DataFrame()

    # For assessment questions: compute % correct pre and post
    assess = df[df["question_type"] == "assessment"]
    if not assess.empty:
        summary = assess.groupby(["question_id", "question_number", "question_text",
                                   "question_category", "activity_name", "phase"]).agg(
            total_responses=("is_correct", "count"),
            correct_count=("is_correct", "sum"),
        ).reset_index()
        summary["pct_correct"] = (summary["correct_count"] / summary["total_responses"] * 100).round(1)

        # Pivot pre/post into columns
        pivot = summary.pivot_table(
            index=["question_id", "question_number", "question_text", "question_category", "activity_name"],
            columns="phase",
            values="pct_correct",
        ).reset_index()

        if "pre" in pivot.columns and "post" in pivot.columns:
            pivot["improvement"] = (pivot["post"] - pivot["pre"]).round(1)
        pivot.columns.name = None
        return pivot

    return pd.DataFrame()


def category_level_analysis(conn, activity_id: str = None) -> pd.DataFrame:
    """Aggregate pre vs post performance by question category.

    Shows how learners performed across Pathophysiology/MOA, Clinical Updates, etc.
    """
    query = """
        SELECT
            q.question_category, qr.phase, qr.is_correct,
            q.activity_id, a.activity_name
        FROM question_responses qr
        JOIN questions q ON qr.question_id = q.question_id
        JOIN participations p ON qr.participation_id = p.participation_id
        JOIN activities a ON q.activity_id = a.activity_id
        WHERE q.question_type = 'assessment' AND q.question_category IS NOT NULL
    """
    if activity_id:
        query += f" AND q.activity_id = '{activity_id}'"

    df = pd.read_sql_query(query, conn)
    if df.empty:
        return pd.DataFrame()

    summary = df.groupby(["question_category", "phase"]).agg(
        total=("is_correct", "count"),
        correct=("is_correct", "sum"),
    ).reset_index()
    summary["pct_correct"] = (summary["correct"] / summary["total"] * 100).round(1)

    pivot = summary.pivot_table(
        index="question_category", columns="phase", values="pct_correct"
    ).reset_index()

    if "pre" in pivot.columns and "post" in pivot.columns:
        pivot["improvement"] = (pivot["post"] - pivot["pre"]).round(1)
    pivot.columns.name = None
    return pivot


def confidence_question_analysis(conn, activity_id: str = None) -> pd.DataFrame:
    """Analyze confidence questions pre vs post (Likert scale 1-5)."""
    query = """
        SELECT
            q.question_id, q.question_number, q.question_text,
            qr.phase, qr.numeric_value,
            q.activity_id, a.activity_name
        FROM question_responses qr
        JOIN questions q ON qr.question_id = q.question_id
        JOIN participations p ON qr.participation_id = p.participation_id
        JOIN activities a ON q.activity_id = a.activity_id
        WHERE q.question_type = 'confidence' AND qr.numeric_value IS NOT NULL
    """
    if activity_id:
        query += f" AND q.activity_id = '{activity_id}'"

    df = pd.read_sql_query(query, conn)
    if df.empty:
        return pd.DataFrame()

    summary = df.groupby(["question_id", "question_text", "activity_name", "phase"]).agg(
        avg_confidence=("numeric_value", "mean"),
        n_responses=("numeric_value", "count"),
    ).reset_index()

    pivot = summary.pivot_table(
        index=["question_id", "question_text", "activity_name"],
        columns="phase",
        values="avg_confidence",
    ).reset_index()

    if "pre" in pivot.columns and "post" in pivot.columns:
        pivot["change"] = (pivot["post"] - pivot["pre"]).round(2)
    pivot.columns.name = None
    return pivot


# --- Evaluation Analysis ---

def evaluation_analysis(conn, activity_id: str = None, category: str = None) -> pd.DataFrame:
    """Analyze evaluation responses (practice profile, intended changes, barriers)."""
    query = """
        SELECT
            er.eval_question_text, er.eval_category, er.response_text, er.response_numeric,
            p.activity_id, a.activity_name,
            l.employer_normalized as employer, l.practice_setting
        FROM evaluation_responses er
        JOIN participations p ON er.participation_id = p.participation_id
        JOIN activities a ON p.activity_id = a.activity_id
        JOIN learners l ON p.learner_id = l.learner_id
        WHERE 1=1
    """
    if activity_id:
        query += f" AND p.activity_id = '{activity_id}'"
    if category:
        query += f" AND er.eval_category = '{category}'"

    return pd.read_sql_query(query, conn)


def intended_changes_summary(conn, activity_id: str = None) -> pd.DataFrame:
    """Summarize what changes learners intend to implement."""
    df = evaluation_analysis(conn, activity_id, category="intended_change")
    if df.empty:
        return pd.DataFrame()

    return df.groupby(["eval_question_text", "response_text"]).agg(
        count=("response_text", "count"),
    ).reset_index().sort_values("count", ascending=False)


def barriers_summary(conn, activity_id: str = None) -> pd.DataFrame:
    """Summarize anticipated barriers."""
    df = evaluation_analysis(conn, activity_id, category="barrier")
    if df.empty:
        return pd.DataFrame()

    return df.groupby(["eval_question_text", "response_text"]).agg(
        count=("response_text", "count"),
    ).reset_index().sort_values("count", ascending=False)


# --- Unified Learner Response View ---

def unified_learner_responses(conn, activity_id: str = None) -> pd.DataFrame:
    """Build a single wide-format DataFrame with one row per learner per activity.

    Each row contains: learner info, all assessment pre/post answers,
    confidence pre/post ratings, and evaluation responses as columns.
    """
    # Base: learner + participation info
    base_query = """
        SELECT
            p.participation_id, p.activity_id, p.participation_date,
            p.pre_score, p.post_score, p.score_change,
            p.pre_confidence_avg, p.post_confidence_avg, p.confidence_change,
            l.learner_id, l.email, l.first_name, l.last_name,
            l.employer_normalized as employer, l.practice_setting, l.role,
            a.activity_name, a.activity_type, a.therapeutic_area, a.disease_state
        FROM participations p
        JOIN learners l ON p.learner_id = l.learner_id
        JOIN activities a ON p.activity_id = a.activity_id
    """
    if activity_id:
        base_query += f" WHERE p.activity_id = '{activity_id}'"

    base_df = pd.read_sql_query(base_query, conn)
    if base_df.empty:
        return pd.DataFrame()

    # Assessment question responses (pre/post)
    assess_query = """
        SELECT
            qr.participation_id, qr.phase,
            q.question_number, q.question_text, q.question_category,
            qr.learner_answer, qr.is_correct
        FROM question_responses qr
        JOIN questions q ON qr.question_id = q.question_id
        WHERE q.question_type = 'assessment'
    """
    if activity_id:
        assess_query += f" AND q.activity_id = '{activity_id}'"

    assess_df = pd.read_sql_query(assess_query, conn)

    if not assess_df.empty:
        for phase in ["pre", "post"]:
            phase_data = assess_df[assess_df["phase"] == phase].copy()
            if phase_data.empty:
                continue
            phase_label = phase.capitalize()
            for _, q_group in phase_data.groupby("question_number"):
                q_num = int(q_group["question_number"].iloc[0])
                col_answer = f"Q{q_num}_{phase_label}_Answer"
                col_correct = f"Q{q_num}_{phase_label}_Correct"

                pivot = q_group[["participation_id", "learner_answer", "is_correct"]].copy()
                pivot = pivot.rename(columns={"learner_answer": col_answer, "is_correct": col_correct})
                base_df = base_df.merge(pivot[["participation_id", col_answer, col_correct]],
                                        on="participation_id", how="left")

    # Confidence question responses (pre/post)
    conf_query = """
        SELECT
            qr.participation_id, qr.phase,
            q.question_number, q.question_text,
            qr.learner_answer, qr.numeric_value
        FROM question_responses qr
        JOIN questions q ON qr.question_id = q.question_id
        WHERE q.question_type = 'confidence'
    """
    if activity_id:
        conf_query += f" AND q.activity_id = '{activity_id}'"

    conf_df = pd.read_sql_query(conf_query, conn)

    if not conf_df.empty:
        for phase in ["pre", "post"]:
            phase_data = conf_df[conf_df["phase"] == phase].copy()
            if phase_data.empty:
                continue
            phase_label = phase.capitalize()
            for _, q_group in phase_data.groupby("question_number"):
                q_num = int(q_group["question_number"].iloc[0])
                col_text = f"Conf{q_num}_{phase_label}_Text"
                col_val = f"Conf{q_num}_{phase_label}_Value"

                pivot = q_group[["participation_id", "learner_answer", "numeric_value"]].copy()
                pivot = pivot.rename(columns={"learner_answer": col_text, "numeric_value": col_val})
                base_df = base_df.merge(pivot[["participation_id", col_text, col_val]],
                                        on="participation_id", how="left")

    # Evaluation responses
    eval_query = """
        SELECT er.participation_id, er.eval_question_text, er.eval_category,
               er.response_text, er.response_numeric
        FROM evaluation_responses er
    """
    if activity_id:
        eval_query += f"""
            JOIN participations p ON er.participation_id = p.participation_id
            WHERE p.activity_id = '{activity_id}'
        """

    eval_df = pd.read_sql_query(eval_query, conn)

    if not eval_df.empty:
        eval_questions = eval_df["eval_question_text"].unique()
        for eq in eval_questions:
            eq_data = eval_df[eval_df["eval_question_text"] == eq].copy()
            col_name = f"Eval_{_short_label(eq)}"
            eq_data["response"] = eq_data["response_text"].fillna(
                eq_data["response_numeric"].astype(str)
            )
            pivot = eq_data[["participation_id", "response"]].copy()
            pivot = pivot.rename(columns={"response": col_name})
            # Handle multiple responses per question (multi-select) by joining
            pivot = pivot.groupby("participation_id")[col_name].agg(
                lambda x: "; ".join(x.dropna())
            ).reset_index()
            base_df = base_df.merge(pivot, on="participation_id", how="left")

    return base_df


def get_question_legend(conn, activity_id: str = None) -> pd.DataFrame:
    """Get a reference table mapping question numbers to text and categories."""
    query = """
        SELECT q.question_number, q.question_text, q.question_type,
               q.question_category, q.correct_answer, a.activity_id, a.activity_name
        FROM questions q
        JOIN activities a ON q.activity_id = a.activity_id
    """
    if activity_id:
        query += f" WHERE q.activity_id = '{activity_id}'"
    query += " ORDER BY q.activity_id, q.question_type, q.question_number"
    return pd.read_sql_query(query, conn)


def _short_label(question_text: str, max_len: int = 30) -> str:
    """Create a short column label from a question text."""
    label = question_text[:max_len].strip()
    label = label.replace(" ", "_").replace("?", "").replace("%", "pct")
    return label
