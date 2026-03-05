"""Learner identity resolution — link records across activities."""

import sqlite3
import pandas as pd


def resolve_learner(conn: sqlite3.Connection, email: str,
                    first_name: str = None, last_name: str = None,
                    employer_raw: str = None, employer_normalized: str = None,
                    practice_setting: str = None, role: str = None) -> int:
    """Find or create a learner record. Returns learner_id."""
    email = email.strip().lower() if email else None
    if not email:
        raise ValueError("Email is required for learner identity resolution")

    cursor = conn.execute("SELECT learner_id FROM learners WHERE email = ?", (email,))
    row = cursor.fetchone()

    if row:
        learner_id = row[0]
        # Update fields if we have new info
        updates = {}
        if first_name:
            updates["first_name"] = first_name.strip()
        if last_name:
            updates["last_name"] = last_name.strip()
        if employer_raw:
            updates["employer_raw"] = employer_raw
        if employer_normalized:
            updates["employer_normalized"] = employer_normalized
        if practice_setting:
            updates["practice_setting"] = practice_setting
        if role:
            updates["role"] = role

        if updates:
            set_clause = ", ".join(f"{k} = ?" for k in updates)
            values = list(updates.values()) + [learner_id]
            conn.execute(
                f"UPDATE learners SET {set_clause}, updated_at = CURRENT_TIMESTAMP WHERE learner_id = ?",
                values,
            )
        return learner_id

    # Create new learner
    cursor = conn.execute(
        """INSERT INTO learners (email, first_name, last_name, employer_raw,
           employer_normalized, practice_setting, role)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (email, first_name, last_name, employer_raw, employer_normalized,
         practice_setting, role),
    )
    return cursor.lastrowid


def get_learner_profile(conn: sqlite3.Connection, learner_id: int) -> dict:
    """Get a complete learner profile with all participations."""
    cursor = conn.execute("SELECT * FROM learners WHERE learner_id = ?", (learner_id,))
    learner = dict(cursor.fetchone())

    cursor = conn.execute(
        """SELECT p.*, a.activity_name, a.activity_type, a.therapeutic_area, a.disease_state
           FROM participations p
           JOIN activities a ON p.activity_id = a.activity_id
           WHERE p.learner_id = ?
           ORDER BY p.participation_date""",
        (learner_id,),
    )
    learner["participations"] = [dict(r) for r in cursor.fetchall()]
    learner["activity_count"] = len(learner["participations"])

    return learner


def get_all_learners_summary(conn: sqlite3.Connection) -> pd.DataFrame:
    """Get a summary DataFrame of all learners with activity counts."""
    query = """
        SELECT l.learner_id, l.email, l.first_name, l.last_name,
               l.employer_normalized as employer, l.practice_setting, l.role,
               COUNT(p.participation_id) as activity_count,
               AVG(p.pre_score) as avg_pre_score,
               AVG(p.post_score) as avg_post_score,
               AVG(p.score_change) as avg_score_change,
               AVG(p.confidence_change) as avg_confidence_change
        FROM learners l
        LEFT JOIN participations p ON l.learner_id = p.learner_id
        GROUP BY l.learner_id
    """
    return pd.read_sql_query(query, conn)
