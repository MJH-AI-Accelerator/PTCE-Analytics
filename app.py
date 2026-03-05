"""PTCE Learner Data Longitudinal Analysis Platform — Streamlit App."""

import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent))

import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go

from src.database.db import init_db, get_connection
from src.ingestion.ingest import ingest_file
from src.ingestion.column_mapper import detect_columns, generate_config_template
from src.ingestion.loader import load_uploaded_file, validate_dataframe
from src.ingestion.normalizer import build_alias_table_from_db, save_alias
from src.identity.resolver import get_all_learners_summary, get_learner_profile
from src.analytics.engine import (
    get_participation_data, employer_performance, employer_comparison,
    yearly_comparison, monthly_trend, participation_depth,
    practice_setting_breakdown, role_breakdown,
    descriptive_stats, paired_ttest, group_comparison_anova,
)
from src.analytics.catalog import (
    get_activity_catalog, get_activity_detail, search_questions,
    find_identical_questions, save_activity, save_learning_objectives,
    save_questions,
)
from src.export.reports import export_to_excel
from src.connectors.refresh import test_all_connections, refresh_from_connector, refresh_all, get_connector

# --- Page Config ---
st.set_page_config(
    page_title="PTCE Analytics",
    page_icon="📊",
    layout="wide",
    initial_sidebar_state="expanded",
)

# Initialize database
init_db()


# --- Sidebar Navigation ---
st.sidebar.title("PTCE Analytics")
page = st.sidebar.radio(
    "Navigation",
    ["Dashboard", "Data Sources", "Data Import", "Program Catalog", "Employer Analysis",
     "Temporal Analysis", "Participation Depth", "Learner Explorer",
     "Employer Management", "Statistical Tests", "Export"],
)


# === Helper: Global Filters ===
def render_filters(conn) -> dict:
    """Render sidebar filters and return filter dict."""
    st.sidebar.markdown("---")
    st.sidebar.subheader("Filters")

    df = get_participation_data(conn)
    if df.empty:
        st.sidebar.info("No data loaded yet.")
        return {}

    filters = {}

    employers = sorted(df["employer"].dropna().unique())
    if employers:
        selected = st.sidebar.multiselect("Employer", employers)
        if selected:
            filters["employer"] = selected

    therapeutic_areas = sorted(df["therapeutic_area"].dropna().unique())
    if therapeutic_areas:
        selected = st.sidebar.multiselect("Therapeutic Area", therapeutic_areas)
        if selected:
            filters["therapeutic_area"] = selected

    disease_states = sorted(df["disease_state"].dropna().unique())
    if disease_states:
        selected = st.sidebar.multiselect("Disease State", disease_states)
        if selected:
            filters["disease_state"] = selected

    practice_settings = sorted(df["practice_setting"].dropna().unique())
    if practice_settings:
        selected = st.sidebar.multiselect("Practice Setting", practice_settings)
        if selected:
            filters["practice_setting"] = selected

    years = sorted(df["year"].dropna().unique()) if "year" in df.columns else []
    if years:
        selected = st.sidebar.multiselect("Year", [int(y) for y in years])
        if selected:
            filters["year"] = selected

    activity_types = sorted(df["activity_type"].dropna().unique())
    if activity_types:
        selected = st.sidebar.multiselect("Activity Type", activity_types)
        if selected:
            filters["activity_type"] = selected

    return filters


# === Pages ===

def page_dashboard():
    st.title("PTCE Learner Analytics Dashboard")

    conn = get_connection()
    filters = render_filters(conn)
    df = get_participation_data(conn, filters)

    if df.empty:
        st.info("No data loaded yet. Go to **Data Import** to upload your first file.")
        conn.close()
        return

    # Filter count preview
    learner_count = df["learner_id"].nunique()
    participation_count = len(df)
    activity_count = df["activity_id"].nunique()

    col1, col2, col3, col4 = st.columns(4)
    col1.metric("Learners", f"{learner_count:,}")
    col2.metric("Participations", f"{participation_count:,}")
    col3.metric("Activities", f"{activity_count:,}")

    avg_change = df["score_change"].mean()
    col4.metric("Avg Score Change", f"{avg_change:+.1f}%" if pd.notna(avg_change) else "N/A")

    st.markdown("---")

    # Key charts
    col_left, col_right = st.columns(2)

    with col_left:
        st.subheader("Score Distribution")
        if df["post_score"].notna().any():
            fig = px.histogram(df, x="post_score", nbins=20, title="Post-Activity Scores")
            st.plotly_chart(fig, use_container_width=True)

    with col_right:
        st.subheader("Confidence Change")
        if df["confidence_change"].notna().any():
            fig = px.histogram(df, x="confidence_change", nbins=10, title="Confidence Change (Post - Pre)")
            st.plotly_chart(fig, use_container_width=True)

    # Year-over-year if available
    if "year" in df.columns and df["year"].nunique() > 1:
        st.subheader("Year-over-Year Performance")
        yearly = yearly_comparison(df)
        if not yearly.empty:
            fig = px.bar(yearly, x="year", y=["avg_pre_score", "avg_post_score"],
                         barmode="group", title="Average Pre vs Post Scores by Year")
            st.plotly_chart(fig, use_container_width=True)

    # Top employers
    st.subheader("Top Employers by Improvement")
    emp = employer_performance(df, min_learners=1)
    if not emp.empty:
        fig = px.bar(emp.head(15), x="employer", y="avg_score_change",
                     title="Average Score Improvement by Employer")
        st.plotly_chart(fig, use_container_width=True)

    conn.close()


def page_data_import():
    st.title("Data Import")

    st.markdown("""
    Upload Excel (.xlsx) or CSV files containing learner activity data.
    The system will auto-detect columns or you can use a YAML config for custom mapping.
    """)

    # Activity metadata
    with st.expander("Step 1: Activity Information", expanded=True):
        act_id = st.text_input("Activity ID (unique identifier)", placeholder="e.g., PTCE-ONC-2025-001")
        act_name = st.text_input("Activity Name", placeholder="e.g., Advances in NSCLC Treatment")
        col1, col2 = st.columns(2)
        with col1:
            act_type = st.selectbox("Activity Type", ["", "Webinar", "Course", "Conference", "Self-Study", "Other"])
            therapeutic_area = st.text_input("Therapeutic Area", placeholder="e.g., Oncology")
            sponsor = st.text_input("Sponsor", placeholder="e.g., Pfizer")
            accred_type = st.text_input("Accreditation Type", placeholder="e.g., ACPE")
        with col2:
            act_date = st.date_input("Activity Date")
            disease_state = st.text_input("Disease State", placeholder="e.g., NSCLC")
            credit_hours = st.number_input("Credit Hours", min_value=0.0, step=0.25, value=0.0)
            target_audience = st.text_input("Target Audience", placeholder="e.g., Pharmacists, Technicians")

        description = st.text_area("Description", placeholder="Brief summary of the activity")

        objectives_text = st.text_area(
            "Learning Objectives (one per line)",
            placeholder="1. Identify current treatment options for...\n2. Describe the mechanism of...",
        )

    # File upload
    with st.expander("Step 2: Upload Data File", expanded=True):
        uploaded = st.file_uploader("Choose a file", type=["xlsx", "xls", "csv"])

        use_config = st.checkbox("Use a YAML column mapping config")
        config_name = None
        if use_config:
            config_name = st.text_input("Config name (without .yaml)", value="default")

    if uploaded and act_id:
        # Preview
        df = load_uploaded_file(uploaded)
        st.subheader("Data Preview")
        st.dataframe(df.head(10), use_container_width=True)

        # Show detected columns
        detected = detect_columns(df)
        st.subheader("Detected Column Mapping")
        st.json(detected)

        # Validation
        validation = validate_dataframe(df)
        if validation["issues"]:
            for issue in validation["issues"]:
                st.error(issue)
        for warning in validation.get("warnings", []):
            st.warning(warning)

        st.info(f"{validation['row_count']} rows, {validation['column_count']} columns")

        # Questions input
        with st.expander("Step 3: Questions (optional)"):
            st.markdown("Enter assessment questions, one per line. Format: `Q#|Question text|Correct answer|Objective #`")
            questions_input = st.text_area(
                "Questions",
                placeholder="1|What is the primary treatment for NSCLC?|Immunotherapy|1\n2|Which biomarker is tested?|PD-L1|1",
            )

        if st.button("Import Data", type="primary"):
            with st.spinner("Importing..."):
                # Save activity metadata
                conn = get_connection()
                save_activity(conn, {
                    "activity_id": act_id,
                    "activity_name": act_name,
                    "activity_type": act_type or None,
                    "activity_date": str(act_date),
                    "therapeutic_area": therapeutic_area or None,
                    "disease_state": disease_state or None,
                    "sponsor": sponsor or None,
                    "accreditation_type": accred_type or None,
                    "credit_hours": credit_hours or None,
                    "target_audience": target_audience or None,
                    "description": description or None,
                })

                # Save objectives
                if objectives_text.strip():
                    objectives = [line.strip() for line in objectives_text.strip().split("\n") if line.strip()]
                    save_learning_objectives(conn, act_id, objectives)

                # Save questions
                if questions_input.strip():
                    questions = []
                    for line in questions_input.strip().split("\n"):
                        parts = line.split("|")
                        q = {"question_text": parts[1].strip() if len(parts) > 1 else parts[0].strip()}
                        if len(parts) > 0 and parts[0].strip().isdigit():
                            q["question_number"] = int(parts[0].strip())
                        if len(parts) > 2:
                            q["correct_answer"] = parts[2].strip()
                        if len(parts) > 3 and parts[3].strip().isdigit():
                            q["objective_number"] = int(parts[3].strip())
                        questions.append(q)
                    save_questions(conn, act_id, questions)

                conn.close()

                # Run ingestion
                uploaded.seek(0)
                stats = ingest_file(
                    uploaded_file=uploaded,
                    config_name=config_name,
                    activity_id=act_id,
                )

            st.success(f"Import complete! {stats['rows_processed']} rows processed, "
                       f"{stats['participations_created']} participations created.")

            if stats["errors"]:
                with st.expander(f"Errors ({len(stats['errors'])})"):
                    for err in stats["errors"][:50]:
                        st.text(err)

            if stats["employer_unmatched"]:
                with st.expander(f"Unmatched employers ({len(stats['employer_unmatched'])})"):
                    st.write("These employer names were not matched. Go to Employer Management to resolve them.")
                    st.write(list(set(stats["employer_unmatched"])))

    elif uploaded and not act_id:
        st.warning("Please enter an Activity ID before importing.")


def page_program_catalog():
    st.title("Program Catalog")

    conn = get_connection()
    catalog = get_activity_catalog(conn)

    if catalog.empty:
        st.info("No activities loaded yet. Go to **Data Import** to add your first program.")
        conn.close()
        return

    # Search and filter
    tab_browse, tab_search, tab_identical = st.tabs(["Browse Programs", "Search Questions", "Identical Questions"])

    with tab_browse:
        col1, col2, col3 = st.columns(3)
        with col1:
            ta_filter = st.multiselect("Therapeutic Area",
                                       sorted(catalog["therapeutic_area"].dropna().unique()))
        with col2:
            type_filter = st.multiselect("Activity Type",
                                         sorted(catalog["activity_type"].dropna().unique()))
        with col3:
            search = st.text_input("Search by name")

        filtered = catalog.copy()
        if ta_filter:
            filtered = filtered[filtered["therapeutic_area"].isin(ta_filter)]
        if type_filter:
            filtered = filtered[filtered["activity_type"].isin(type_filter)]
        if search:
            filtered = filtered[filtered["activity_name"].str.contains(search, case=False, na=False)]

        st.dataframe(
            filtered[["activity_id", "activity_name", "activity_type", "activity_date",
                       "therapeutic_area", "disease_state", "sponsor", "learner_count",
                       "avg_score_change"]],
            use_container_width=True,
        )

        # Activity detail
        if not filtered.empty:
            selected_id = st.selectbox("Select activity for detail view",
                                       filtered["activity_id"].tolist())
            if selected_id:
                detail = get_activity_detail(conn, selected_id)
                if detail:
                    st.subheader(detail["activity_name"])
                    col1, col2, col3 = st.columns(3)
                    col1.write(f"**Type:** {detail.get('activity_type', 'N/A')}")
                    col1.write(f"**Date:** {detail.get('activity_date', 'N/A')}")
                    col2.write(f"**Therapeutic Area:** {detail.get('therapeutic_area', 'N/A')}")
                    col2.write(f"**Disease State:** {detail.get('disease_state', 'N/A')}")
                    col3.write(f"**Sponsor:** {detail.get('sponsor', 'N/A')}")
                    col3.write(f"**Credits:** {detail.get('credit_hours', 'N/A')}")

                    if detail.get("description"):
                        st.write(f"**Description:** {detail['description']}")

                    perf = detail.get("performance", {})
                    if perf.get("learner_count"):
                        st.metric("Learners", perf["learner_count"])

                    if detail["objectives"]:
                        st.subheader("Learning Objectives")
                        for obj in detail["objectives"]:
                            st.write(f"{obj['objective_number']}. {obj['objective_text']}")

                    if detail["questions"]:
                        st.subheader("Assessment Questions")
                        for q in detail["questions"]:
                            obj_text = f" (Objective: {q['objective_text']})" if q.get("objective_text") else ""
                            st.write(f"Q{q.get('question_number', '?')}: {q['question_text']}{obj_text}")

    with tab_search:
        st.subheader("Search Questions Across Programs")
        search_text = st.text_input("Search question text", placeholder="e.g., biomarker testing")
        threshold = st.slider("Fuzzy match threshold", 50, 100, 80)

        if search_text:
            results = search_questions(conn, search_text, threshold)
            if results.empty:
                st.info("No matching questions found.")
            else:
                st.success(f"Found {len(results)} matching questions across {results['activity_id'].nunique()} programs")
                st.dataframe(
                    results[["question_text", "activity_name", "therapeutic_area",
                             "activity_date", "match_type", "match_score"]],
                    use_container_width=True,
                )

    with tab_identical:
        st.subheader("Identical Questions Across Programs")
        st.markdown("Find assessment questions that are reused across different activities.")
        sim_threshold = st.slider("Similarity threshold", 80, 100, 95)

        if st.button("Find Identical Questions"):
            groups = find_identical_questions(conn, sim_threshold)
            if not groups:
                st.info("No identical questions found across programs.")
            else:
                st.success(f"Found {len(groups)} question groups shared across programs")
                for group in groups:
                    with st.expander(f"{group['question_text'][:80]}... ({group['count']} programs)"):
                        st.write(f"**Full question:** {group['question_text']}")
                        st.write("**Used in:**")
                        for act in group["activities"]:
                            st.write(f"- {act['activity_name']} ({act['activity_id']})")

    conn.close()


def page_employer_analysis():
    st.title("Employer Analysis")

    conn = get_connection()
    filters = render_filters(conn)
    df = get_participation_data(conn, filters)

    if df.empty:
        st.info("No data available.")
        conn.close()
        return

    st.write(f"Analyzing **{df['learner_id'].nunique()}** learners across **{df['activity_id'].nunique()}** activities")

    # Employer performance table
    min_learners = st.slider("Minimum learners per employer", 1, 50, 5)
    emp = employer_performance(df, min_learners)

    if emp.empty:
        st.warning("No employers meet the minimum learner threshold.")
    else:
        st.subheader("Employer Performance Ranking")
        st.dataframe(emp, use_container_width=True)

        # Chart
        fig = px.bar(emp.head(20), x="employer", y="avg_score_change",
                     color="avg_score_change",
                     color_continuous_scale="RdYlGn",
                     title="Score Improvement by Employer")
        fig.update_layout(xaxis_tickangle=-45)
        st.plotly_chart(fig, use_container_width=True)

        # Head-to-head comparison
        st.subheader("Head-to-Head Comparison")
        employers = sorted(emp["employer"].tolist())
        col1, col2 = st.columns(2)
        with col1:
            emp_a = st.selectbox("Employer A", employers, index=0)
        with col2:
            emp_b = st.selectbox("Employer B", employers, index=min(1, len(employers) - 1))

        if emp_a and emp_b and emp_a != emp_b:
            comparison = employer_comparison(df, emp_a, emp_b)
            st.json(comparison)

    conn.close()


def page_temporal_analysis():
    st.title("Temporal Analysis")

    conn = get_connection()
    filters = render_filters(conn)
    df = get_participation_data(conn, filters)

    if df.empty:
        st.info("No data available.")
        conn.close()
        return

    # Year-over-year
    st.subheader("Year-over-Year Comparison")
    yearly = yearly_comparison(df)
    if not yearly.empty and len(yearly) > 1:
        st.dataframe(yearly, use_container_width=True)

        fig = px.bar(yearly, x="year", y=["avg_pre_score", "avg_post_score"],
                     barmode="group", title="Pre vs Post Scores by Year")
        st.plotly_chart(fig, use_container_width=True)

        fig2 = px.line(yearly, x="year", y="avg_score_change",
                       title="Average Score Improvement by Year", markers=True)
        st.plotly_chart(fig2, use_container_width=True)
    else:
        st.info("Need data from multiple years for year-over-year comparison.")

    # Monthly trend
    st.subheader("Monthly Trends")
    monthly = monthly_trend(df)
    if not monthly.empty and len(monthly) > 1:
        fig = px.line(monthly, x="month", y="avg_score_change",
                      title="Monthly Score Improvement Trend", markers=True)
        st.plotly_chart(fig, use_container_width=True)

        fig2 = px.bar(monthly, x="month", y="learner_count",
                      title="Monthly Learner Participation")
        st.plotly_chart(fig2, use_container_width=True)

    conn.close()


def page_participation_depth():
    st.title("Participation Depth Analysis")

    conn = get_connection()
    filters = render_filters(conn)
    df = get_participation_data(conn, filters)

    if df.empty:
        st.info("No data available.")
        conn.close()
        return

    depth = participation_depth(df)
    if not depth.empty:
        st.subheader("Outcomes by Participation Level")
        st.dataframe(depth, use_container_width=True)

        fig = px.bar(depth, x="depth_segment", y="avg_score_change",
                     text="learner_count",
                     title="Score Improvement by Number of Activities Completed")
        fig.update_traces(textposition="outside")
        st.plotly_chart(fig, use_container_width=True)

        fig2 = px.bar(depth, x="depth_segment", y="avg_confidence_change",
                      title="Confidence Change by Participation Depth")
        st.plotly_chart(fig2, use_container_width=True)

    # Practice setting breakdown
    st.markdown("---")
    st.subheader("Practice Setting Breakdown")
    ps = practice_setting_breakdown(df)
    if not ps.empty:
        st.dataframe(ps, use_container_width=True)
        fig = px.bar(ps, x="practice_setting", y="avg_score_change",
                     title="Score Improvement by Practice Setting")
        st.plotly_chart(fig, use_container_width=True)

    # Role breakdown
    st.subheader("Role Breakdown")
    rb = role_breakdown(df)
    if not rb.empty:
        st.dataframe(rb, use_container_width=True)

    conn.close()


def page_learner_explorer():
    st.title("Learner Explorer")

    conn = get_connection()
    learners = get_all_learners_summary(conn)

    if learners.empty:
        st.info("No learners in database.")
        conn.close()
        return

    # Search
    search = st.text_input("Search by email or name")
    if search:
        mask = (
            learners["email"].str.contains(search, case=False, na=False) |
            learners["first_name"].str.contains(search, case=False, na=False) |
            learners["last_name"].str.contains(search, case=False, na=False)
        )
        learners = learners[mask]

    st.dataframe(learners, use_container_width=True)

    # Individual profile
    if not learners.empty:
        selected = st.selectbox("Select learner for profile",
                                learners["email"].tolist())
        if selected:
            lid = learners[learners["email"] == selected]["learner_id"].values[0]
            profile = get_learner_profile(conn, lid)

            st.subheader(f"{profile.get('first_name', '')} {profile.get('last_name', '')}")
            st.write(f"**Email:** {profile['email']}")
            st.write(f"**Employer:** {profile.get('employer_normalized', 'N/A')}")
            st.write(f"**Practice Setting:** {profile.get('practice_setting', 'N/A')}")
            st.write(f"**Activities Completed:** {profile['activity_count']}")

            if profile["participations"]:
                st.subheader("Activity History")
                hist_df = pd.DataFrame(profile["participations"])
                display_cols = [c for c in ["activity_name", "participation_date", "pre_score",
                                            "post_score", "score_change", "confidence_change"] if c in hist_df.columns]
                st.dataframe(hist_df[display_cols], use_container_width=True)

    conn.close()


def page_employer_management():
    st.title("Employer Name Management")

    conn = get_connection()

    # Show current aliases
    aliases_df = pd.read_sql_query("SELECT * FROM employer_aliases ORDER BY canonical_name", conn)
    unmatched = pd.read_sql_query(
        """SELECT DISTINCT employer_raw, COUNT(*) as count
           FROM learners WHERE employer_normalized = employer_raw
           AND employer_raw != '' AND employer_raw IS NOT NULL
           GROUP BY employer_raw ORDER BY count DESC""",
        conn,
    )

    tab_aliases, tab_unmatched, tab_log = st.tabs(["Alias Table", "Unmatched Names", "Normalization Log"])

    with tab_aliases:
        st.subheader("Employer Alias Table")
        if not aliases_df.empty:
            st.dataframe(aliases_df[["raw_name", "canonical_name", "match_method", "confidence", "reviewed"]],
                         use_container_width=True)

        st.subheader("Add New Alias")
        col1, col2 = st.columns(2)
        with col1:
            raw = st.text_input("Raw employer name")
        with col2:
            canonical = st.text_input("Canonical (normalized) name")

        if st.button("Save Alias") and raw and canonical:
            save_alias(conn, raw, canonical)
            st.success(f"Saved: '{raw}' -> '{canonical}'")
            st.rerun()

    with tab_unmatched:
        st.subheader("Unmatched Employer Names")
        if unmatched.empty:
            st.success("All employer names have been matched!")
        else:
            st.warning(f"{len(unmatched)} unmatched employer names")
            st.dataframe(unmatched, use_container_width=True)

    with tab_log:
        st.subheader("Normalization Log")
        log_df = pd.read_sql_query(
            "SELECT * FROM normalization_log ORDER BY created_at DESC LIMIT 200", conn
        )
        if not log_df.empty:
            st.dataframe(log_df, use_container_width=True)
        else:
            st.info("No normalization activity logged yet.")

    conn.close()


def page_statistical_tests():
    st.title("Statistical Tests")

    conn = get_connection()
    filters = render_filters(conn)
    df = get_participation_data(conn, filters)

    if df.empty:
        st.info("No data available.")
        conn.close()
        return

    # Descriptive stats
    st.subheader("Descriptive Statistics")
    metric = st.selectbox("Select metric", ["post_score", "pre_score", "score_change",
                                             "post_confidence", "pre_confidence", "confidence_change"])
    stats = descriptive_stats(df[metric])
    if stats:
        cols = st.columns(4)
        cols[0].metric("Mean", stats["mean"])
        cols[1].metric("Median", stats["median"])
        cols[2].metric("Std Dev", stats["std"])
        cols[3].metric("N", stats["count"])

        fig = px.box(df, y=metric, title=f"Distribution of {metric}")
        st.plotly_chart(fig, use_container_width=True)

    # Paired t-test
    st.markdown("---")
    st.subheader("Paired t-test: Pre vs Post")

    test_type = st.radio("Test on:", ["Scores", "Confidence"])
    if test_type == "Scores":
        result = paired_ttest(df["pre_score"], df["post_score"])
    else:
        result = paired_ttest(df["pre_confidence"], df["post_confidence"])

    if "error" in result:
        st.warning(result["error"])
    else:
        col1, col2, col3, col4 = st.columns(4)
        col1.metric("Pre Mean", result["pre_mean"])
        col2.metric("Post Mean", result["post_mean"])
        col3.metric("p-value", result["p_value"])
        col4.metric("Cohen's d", result["cohens_d"])

        if result["significant"]:
            st.success(f"Statistically significant (p = {result['p_value']})")
        else:
            st.info(f"Not statistically significant (p = {result['p_value']})")

    # ANOVA
    st.markdown("---")
    st.subheader("Group Comparison (ANOVA)")
    group_col = st.selectbox("Group by", ["employer", "practice_setting", "role",
                                           "activity_type", "therapeutic_area"])
    metric_col = st.selectbox("Metric", ["score_change", "post_score", "confidence_change"],
                              key="anova_metric")

    anova = group_comparison_anova(df, group_col, metric_col)
    if "error" in anova:
        st.warning(anova["error"])
    else:
        st.write(f"F-statistic: {anova['f_statistic']}, p-value: {anova['p_value']}, "
                 f"Groups: {anova['n_groups']}")
        if anova["significant"]:
            st.success("Significant differences exist between groups")
        else:
            st.info("No significant differences between groups")

    conn.close()


def page_export():
    st.title("Export Reports")

    conn = get_connection()
    filters = render_filters(conn)
    df = get_participation_data(conn, filters)

    if df.empty:
        st.info("No data available.")
        conn.close()
        return

    st.write(f"Export will include **{df['learner_id'].nunique()}** learners, "
             f"**{len(df)}** participation records")

    export_type = st.radio("Export type", ["Raw learner-level data", "Aggregate summary reports", "Both"])

    if st.button("Generate Export", type="primary"):
        sheets = {}

        if export_type in ["Raw learner-level data", "Both"]:
            sheets["Learner Data"] = df

        if export_type in ["Aggregate summary reports", "Both"]:
            emp = employer_performance(df, min_learners=1)
            if not emp.empty:
                sheets["Employer Performance"] = emp

            yearly = yearly_comparison(df)
            if not yearly.empty:
                sheets["Yearly Comparison"] = yearly

            depth = participation_depth(df)
            if not depth.empty:
                sheets["Participation Depth"] = depth

            ps = practice_setting_breakdown(df)
            if not ps.empty:
                sheets["Practice Setting"] = ps

            rb = role_breakdown(df)
            if not rb.empty:
                sheets["Role Breakdown"] = rb

        if sheets:
            excel_bytes = export_to_excel(sheets)
            st.download_button(
                label="Download Excel Report",
                data=excel_bytes,
                file_name="ptce_analytics_report.xlsx",
                mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )

    conn.close()


def page_data_sources():
    st.title("Data Sources & Refresh")

    st.markdown("""
    Connect to external platforms to pull learner data automatically.
    Configure credentials in the `.env` file, then test and refresh from here.
    """)

    # Connection status
    st.subheader("Connection Status")
    if st.button("Test All Connections"):
        with st.spinner("Testing connections..."):
            results = test_all_connections()
        for name, result in results.items():
            if result["success"]:
                st.success(f"**{name.title()}**: {result['message']}")
            else:
                st.error(f"**{name.title()}**: {result['message']}")

    st.markdown("---")

    # Individual connector controls
    st.subheader("Refresh Data")

    col1, col2 = st.columns([2, 1])
    with col1:
        connector_choice = st.selectbox(
            "Select platform",
            ["All Platforms", "Snowflake", "GlobalMeet", "Array", "Pigeonhole"],
        )
    with col2:
        refresh_type = st.radio("Refresh type", ["Incremental (last 24h)", "Full refresh"])

    full_refresh = refresh_type == "Full refresh"

    if st.button("Refresh Now", type="primary"):
        with st.spinner(f"Pulling data from {connector_choice}..."):
            if connector_choice == "All Platforms":
                results = refresh_all(full_refresh=full_refresh)
                for name, stats in results.items():
                    errors = stats.get("errors", [])
                    if errors:
                        st.warning(f"**{name.title()}**: {stats.get('learners_processed', 0)} learners, "
                                   f"{len(errors)} errors")
                        with st.expander(f"{name} errors"):
                            for e in errors[:20]:
                                st.text(e)
                    else:
                        st.success(f"**{name.title()}**: {stats.get('activities_fetched', 0)} activities, "
                                   f"{stats.get('learners_processed', 0)} learners")
            else:
                name = connector_choice.lower().replace(" ", "")
                stats = refresh_from_connector(name, full_refresh=full_refresh)
                errors = stats.get("errors", [])
                if errors and any("Connection failed" in e for e in errors):
                    st.error(f"Could not connect to {connector_choice}. Check your `.env` credentials.")
                    for e in errors:
                        st.text(e)
                elif errors:
                    st.warning(f"{stats.get('learners_processed', 0)} learners processed, {len(errors)} errors")
                    with st.expander("Errors"):
                        for e in errors[:20]:
                            st.text(e)
                else:
                    st.success(f"{stats.get('activities_fetched', 0)} activities, "
                               f"{stats.get('learners_processed', 0)} learners pulled successfully!")

    # Scheduler info
    st.markdown("---")
    st.subheader("Automatic Daily Refresh")
    st.markdown("""
    To set up automatic daily data refresh:

    1. Open **Windows Task Scheduler**
    2. Click **Create Basic Task**
    3. Name: `PTCE Analytics Daily Refresh`
    4. Trigger: **Daily** at your preferred time (e.g., 6:00 AM)
    5. Action: **Start a Program**
       - **Program**: `C:\\Users\\fagustin\\AppData\\Local\\Programs\\Python\\Python312\\python.exe`
       - **Arguments**: `refresh_scheduler.py`
       - **Start in**: `C:\\Users\\fagustin\\Documents\\GitHub\\ptce-analytics`
    6. Click **Finish**

    Refresh logs are saved in `data/logs/`.
    """)

    # Show recent logs
    log_dir = Path(__file__).parent / "data" / "logs"
    if log_dir.exists():
        log_files = sorted(log_dir.glob("refresh_*.log"), reverse=True)[:5]
        if log_files:
            st.subheader("Recent Refresh Logs")
            for lf in log_files:
                with st.expander(lf.name):
                    st.text(lf.read_text())

    # Credential status helper
    st.markdown("---")
    st.subheader("Credential Configuration")
    st.markdown("""
    Edit the `.env` file in the project root to configure credentials:

    ```
    C:\\Users\\fagustin\\Documents\\GitHub\\ptce-analytics\\.env
    ```

    See `.env.example` for all available settings.
    """)

    env_path = Path(__file__).parent / ".env"
    if env_path.exists():
        st.success(".env file found")
    else:
        st.warning(".env file not found. Copy `.env.example` to `.env` and fill in your credentials.")


# --- Route Pages ---
PAGES = {
    "Dashboard": page_dashboard,
    "Data Sources": page_data_sources,
    "Data Import": page_data_import,
    "Program Catalog": page_program_catalog,
    "Employer Analysis": page_employer_analysis,
    "Temporal Analysis": page_temporal_analysis,
    "Participation Depth": page_participation_depth,
    "Learner Explorer": page_learner_explorer,
    "Employer Management": page_employer_management,
    "Statistical Tests": page_statistical_tests,
    "Export": page_export,
}

PAGES[page]()
