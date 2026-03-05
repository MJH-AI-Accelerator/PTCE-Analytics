"""Activity catalog — program rolodex with cross-program question search."""

import sqlite3
import pandas as pd
from rapidfuzz import fuzz, process


def get_activity_catalog(conn: sqlite3.Connection) -> pd.DataFrame:
    """Get all activities as a browsable catalog."""
    query = """
        SELECT a.*,
               COUNT(DISTINCT p.learner_id) as learner_count,
               AVG(p.score_change) as avg_score_change,
               AVG(p.confidence_change) as avg_confidence_change
        FROM activities a
        LEFT JOIN participations p ON a.activity_id = p.activity_id
        GROUP BY a.activity_id
        ORDER BY a.activity_date DESC
    """
    return pd.read_sql_query(query, conn)


def get_activity_detail(conn: sqlite3.Connection, activity_id: str) -> dict:
    """Get full detail for a single activity including objectives and questions."""
    cursor = conn.execute("SELECT * FROM activities WHERE activity_id = ?", (activity_id,))
    row = cursor.fetchone()
    if not row:
        return None
    activity = dict(row)

    # Learning objectives
    cursor = conn.execute(
        "SELECT * FROM learning_objectives WHERE activity_id = ? ORDER BY objective_number",
        (activity_id,),
    )
    activity["objectives"] = [dict(r) for r in cursor.fetchall()]

    # Questions
    cursor = conn.execute(
        """SELECT q.*, lo.objective_text
           FROM questions q
           LEFT JOIN learning_objectives lo ON q.objective_id = lo.objective_id
           WHERE q.activity_id = ?
           ORDER BY q.question_number""",
        (activity_id,),
    )
    activity["questions"] = [dict(r) for r in cursor.fetchall()]

    # Learner count and performance summary
    cursor = conn.execute(
        """SELECT COUNT(DISTINCT learner_id) as learner_count,
                  AVG(pre_score) as avg_pre_score,
                  AVG(post_score) as avg_post_score,
                  AVG(score_change) as avg_score_change,
                  AVG(confidence_change) as avg_confidence_change
           FROM participations WHERE activity_id = ?""",
        (activity_id,),
    )
    activity["performance"] = dict(cursor.fetchone())

    return activity


def search_questions(conn: sqlite3.Connection, search_text: str,
                     fuzzy_threshold: int = 80) -> pd.DataFrame:
    """Search for questions across all activities.

    Returns questions matching the search text (exact substring or fuzzy match),
    grouped to show which activities share the same/similar questions.
    """
    cursor = conn.execute(
        """SELECT q.question_id, q.question_text, q.question_number, q.question_type,
                  q.correct_answer, q.activity_id, a.activity_name, a.activity_type,
                  a.therapeutic_area, a.disease_state, a.activity_date
           FROM questions q
           JOIN activities a ON q.activity_id = a.activity_id"""
    )
    all_questions = [dict(r) for r in cursor.fetchall()]

    if not all_questions:
        return pd.DataFrame()

    search_lower = search_text.lower().strip()
    results = []

    for q in all_questions:
        q_text = q["question_text"]
        q_lower = q_text.lower()

        # Exact substring match
        if search_lower in q_lower:
            q["match_type"] = "exact"
            q["match_score"] = 100
            results.append(q)
        else:
            # Fuzzy match
            score = fuzz.token_sort_ratio(search_lower, q_lower)
            if score >= fuzzy_threshold:
                q["match_type"] = "fuzzy"
                q["match_score"] = score
                results.append(q)

    df = pd.DataFrame(results)
    if not df.empty:
        df = df.sort_values("match_score", ascending=False)
    return df


def find_identical_questions(conn: sqlite3.Connection,
                             similarity_threshold: int = 95) -> list[dict]:
    """Find questions that are identical or near-identical across different activities.

    Returns groups of matching questions.
    """
    cursor = conn.execute(
        """SELECT q.question_id, q.question_text, q.activity_id, a.activity_name
           FROM questions q
           JOIN activities a ON q.activity_id = a.activity_id"""
    )
    all_questions = [dict(r) for r in cursor.fetchall()]

    if len(all_questions) < 2:
        return []

    # Group by normalized text
    groups = {}
    processed = set()

    for i, q in enumerate(all_questions):
        if i in processed:
            continue

        q_text = q["question_text"].strip().lower()
        group = [q]
        processed.add(i)

        for j, other in enumerate(all_questions):
            if j in processed or q["activity_id"] == other["activity_id"]:
                continue
            score = fuzz.token_sort_ratio(q_text, other["question_text"].strip().lower())
            if score >= similarity_threshold:
                group.append(other)
                processed.add(j)

        if len(group) > 1:
            groups[q["question_text"]] = {
                "question_text": q["question_text"],
                "activities": [
                    {"activity_id": g["activity_id"], "activity_name": g["activity_name"]}
                    for g in group
                ],
                "count": len(group),
            }

    return sorted(groups.values(), key=lambda x: x["count"], reverse=True)


def save_activity(conn: sqlite3.Connection, activity: dict):
    """Save or update activity metadata."""
    conn.execute(
        """INSERT OR REPLACE INTO activities
           (activity_id, activity_name, activity_type, activity_date,
            therapeutic_area, disease_state, sponsor, accreditation_type,
            credit_hours, target_audience, description)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (activity["activity_id"], activity["activity_name"],
         activity.get("activity_type"), activity.get("activity_date"),
         activity.get("therapeutic_area"), activity.get("disease_state"),
         activity.get("sponsor"), activity.get("accreditation_type"),
         activity.get("credit_hours"), activity.get("target_audience"),
         activity.get("description")),
    )
    conn.commit()


def save_learning_objectives(conn: sqlite3.Connection, activity_id: str, objectives: list[str]):
    """Save learning objectives for an activity."""
    conn.execute("DELETE FROM learning_objectives WHERE activity_id = ?", (activity_id,))
    for i, obj in enumerate(objectives, 1):
        conn.execute(
            "INSERT INTO learning_objectives (activity_id, objective_number, objective_text) VALUES (?, ?, ?)",
            (activity_id, i, obj),
        )
    conn.commit()


def save_questions(conn: sqlite3.Connection, activity_id: str, questions: list[dict]):
    """Save questions for an activity.

    Each question dict should have: question_text, and optionally
    question_number, question_type, correct_answer, objective_number.
    """
    conn.execute("DELETE FROM questions WHERE activity_id = ?", (activity_id,))
    for q in questions:
        # Link to objective if objective_number provided
        objective_id = None
        if q.get("objective_number"):
            cursor = conn.execute(
                "SELECT objective_id FROM learning_objectives WHERE activity_id = ? AND objective_number = ?",
                (activity_id, q["objective_number"]),
            )
            row = cursor.fetchone()
            if row:
                objective_id = row[0]

        conn.execute(
            """INSERT INTO questions
               (activity_id, question_number, question_text, question_type, correct_answer, objective_id)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (activity_id, q.get("question_number"), q["question_text"],
             q.get("question_type", "assessment"), q.get("correct_answer"), objective_id),
        )
    conn.commit()
