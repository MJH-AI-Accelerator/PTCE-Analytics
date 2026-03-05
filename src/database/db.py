"""SQLite database layer for PTCE Analytics."""

import sqlite3
from pathlib import Path

DEFAULT_DB_PATH = Path(__file__).parent.parent.parent / "data" / "ptce_analytics.db"


def get_connection(db_path: Path = DEFAULT_DB_PATH) -> sqlite3.Connection:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db(db_path: Path = DEFAULT_DB_PATH):
    conn = get_connection(db_path)
    cursor = conn.cursor()

    cursor.executescript("""
        CREATE TABLE IF NOT EXISTS learners (
            learner_id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL,
            first_name TEXT,
            last_name TEXT,
            employer_raw TEXT,
            employer_normalized TEXT,
            practice_setting TEXT,
            role TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(email)
        );

        CREATE TABLE IF NOT EXISTS activities (
            activity_id TEXT PRIMARY KEY,
            activity_name TEXT NOT NULL,
            activity_type TEXT,
            activity_date TEXT,
            therapeutic_area TEXT,
            disease_state TEXT,
            sponsor TEXT,
            accreditation_type TEXT,
            credit_hours REAL,
            target_audience TEXT,
            description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS learning_objectives (
            objective_id INTEGER PRIMARY KEY AUTOINCREMENT,
            activity_id TEXT NOT NULL,
            objective_number INTEGER,
            objective_text TEXT NOT NULL,
            FOREIGN KEY (activity_id) REFERENCES activities(activity_id)
        );

        CREATE TABLE IF NOT EXISTS questions (
            question_id INTEGER PRIMARY KEY AUTOINCREMENT,
            activity_id TEXT NOT NULL,
            question_number INTEGER,
            question_text TEXT NOT NULL,
            question_type TEXT DEFAULT 'assessment',
            correct_answer TEXT,
            objective_id INTEGER,
            FOREIGN KEY (activity_id) REFERENCES activities(activity_id),
            FOREIGN KEY (objective_id) REFERENCES learning_objectives(objective_id)
        );

        CREATE TABLE IF NOT EXISTS participations (
            participation_id INTEGER PRIMARY KEY AUTOINCREMENT,
            learner_id INTEGER NOT NULL,
            activity_id TEXT NOT NULL,
            participation_date TEXT,
            pre_score REAL,
            post_score REAL,
            pre_confidence_raw TEXT,
            post_confidence_raw TEXT,
            pre_confidence_numeric REAL,
            post_confidence_numeric REAL,
            confidence_change REAL,
            score_change REAL,
            comments TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (learner_id) REFERENCES learners(learner_id),
            FOREIGN KEY (activity_id) REFERENCES activities(activity_id),
            UNIQUE(learner_id, activity_id)
        );

        CREATE TABLE IF NOT EXISTS question_responses (
            response_id INTEGER PRIMARY KEY AUTOINCREMENT,
            participation_id INTEGER NOT NULL,
            question_id INTEGER NOT NULL,
            learner_answer TEXT,
            is_correct INTEGER,
            phase TEXT CHECK(phase IN ('pre', 'post', 'pulse')),
            FOREIGN KEY (participation_id) REFERENCES participations(participation_id),
            FOREIGN KEY (question_id) REFERENCES questions(question_id)
        );

        CREATE TABLE IF NOT EXISTS employer_aliases (
            alias_id INTEGER PRIMARY KEY AUTOINCREMENT,
            raw_name TEXT NOT NULL UNIQUE,
            canonical_name TEXT NOT NULL,
            match_method TEXT,
            confidence REAL,
            reviewed INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS normalization_log (
            log_id INTEGER PRIMARY KEY AUTOINCREMENT,
            field_name TEXT NOT NULL,
            original_value TEXT,
            normalized_value TEXT,
            method TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS role_data (
            role_data_id INTEGER PRIMARY KEY AUTOINCREMENT,
            participation_id INTEGER NOT NULL,
            role_field TEXT NOT NULL,
            role_value TEXT,
            role_percentage REAL,
            FOREIGN KEY (participation_id) REFERENCES participations(participation_id)
        );

        CREATE INDEX IF NOT EXISTS idx_learners_email ON learners(email);
        CREATE INDEX IF NOT EXISTS idx_learners_employer ON learners(employer_normalized);
        CREATE INDEX IF NOT EXISTS idx_participations_learner ON participations(learner_id);
        CREATE INDEX IF NOT EXISTS idx_participations_activity ON participations(activity_id);
        CREATE INDEX IF NOT EXISTS idx_questions_activity ON questions(activity_id);
        CREATE INDEX IF NOT EXISTS idx_questions_text ON questions(question_text);
        CREATE INDEX IF NOT EXISTS idx_question_responses_participation ON question_responses(participation_id);
    """)

    conn.commit()
    conn.close()
