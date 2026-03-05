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

        -- Assessment & confidence questions defined per activity
        CREATE TABLE IF NOT EXISTS questions (
            question_id INTEGER PRIMARY KEY AUTOINCREMENT,
            activity_id TEXT NOT NULL,
            question_number INTEGER,
            question_text TEXT NOT NULL,
            question_type TEXT DEFAULT 'assessment'
                CHECK(question_type IN ('assessment', 'confidence', 'evaluation', 'pulse')),
            question_category TEXT,
            correct_answer TEXT,
            objective_id INTEGER,
            FOREIGN KEY (activity_id) REFERENCES activities(activity_id),
            FOREIGN KEY (objective_id) REFERENCES learning_objectives(objective_id)
        );

        -- Standard assessment question categories
        CREATE TABLE IF NOT EXISTS question_categories (
            category_id INTEGER PRIMARY KEY AUTOINCREMENT,
            category_name TEXT NOT NULL UNIQUE,
            description TEXT
        );

        -- Learner participation in an activity (one row per learner per activity)
        CREATE TABLE IF NOT EXISTS participations (
            participation_id INTEGER PRIMARY KEY AUTOINCREMENT,
            learner_id INTEGER NOT NULL,
            activity_id TEXT NOT NULL,
            participation_date TEXT,
            -- Aggregate scores computed from individual question responses
            pre_score REAL,
            post_score REAL,
            score_change REAL,
            -- Confidence (may have multiple confidence questions; these are averages)
            pre_confidence_avg REAL,
            post_confidence_avg REAL,
            confidence_change REAL,
            comments TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (learner_id) REFERENCES learners(learner_id),
            FOREIGN KEY (activity_id) REFERENCES activities(activity_id),
            UNIQUE(learner_id, activity_id)
        );

        -- Individual question responses (pre and post for same question)
        CREATE TABLE IF NOT EXISTS question_responses (
            response_id INTEGER PRIMARY KEY AUTOINCREMENT,
            participation_id INTEGER NOT NULL,
            question_id INTEGER NOT NULL,
            phase TEXT NOT NULL CHECK(phase IN ('pre', 'post')),
            learner_answer TEXT,
            is_correct INTEGER,
            -- For confidence questions: numeric value (1-5)
            numeric_value REAL,
            FOREIGN KEY (participation_id) REFERENCES participations(participation_id),
            FOREIGN KEY (question_id) REFERENCES questions(question_id)
        );

        -- Evaluation responses (post-activity survey: demographics, intent, barriers)
        CREATE TABLE IF NOT EXISTS evaluation_responses (
            eval_response_id INTEGER PRIMARY KEY AUTOINCREMENT,
            participation_id INTEGER NOT NULL,
            question_id INTEGER,
            eval_question_text TEXT NOT NULL,
            eval_category TEXT CHECK(eval_category IN (
                'practice_profile', 'intended_change', 'barrier', 'demographic', 'custom'
            )),
            response_text TEXT,
            response_numeric REAL,
            FOREIGN KEY (participation_id) REFERENCES participations(participation_id),
            FOREIGN KEY (question_id) REFERENCES questions(question_id)
        );

        -- Standard evaluation questions (core set reused across activities)
        CREATE TABLE IF NOT EXISTS evaluation_templates (
            template_id INTEGER PRIMARY KEY AUTOINCREMENT,
            question_text TEXT NOT NULL,
            eval_category TEXT NOT NULL,
            response_type TEXT DEFAULT 'text'
                CHECK(response_type IN ('text', 'single_select', 'multi_select', 'percentage', 'free_text')),
            is_standard INTEGER DEFAULT 1
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
        CREATE INDEX IF NOT EXISTS idx_question_responses_question ON question_responses(question_id);
        CREATE INDEX IF NOT EXISTS idx_question_responses_phase ON question_responses(phase);
        CREATE INDEX IF NOT EXISTS idx_evaluation_responses_participation ON evaluation_responses(participation_id);
        CREATE INDEX IF NOT EXISTS idx_evaluation_responses_category ON evaluation_responses(eval_category);
        CREATE INDEX IF NOT EXISTS idx_questions_category ON questions(question_category);
        CREATE INDEX IF NOT EXISTS idx_questions_type ON questions(question_type);
    """)

    # Seed standard question categories
    standard_categories = [
        ("Pathophysiology / Mechanism of Action", "Questions about disease mechanisms and drug MOA"),
        ("Clinical Updates", "Questions about recent clinical data, guidelines, and trial results"),
        ("Patient Recommendations", "Questions about counseling, treatment selection, and patient care"),
        ("Disease Burden", "Questions about epidemiology, prevalence, and impact of disease"),
        ("Role of the Pharmacist", "Questions about pharmacist responsibilities and scope of practice"),
    ]
    for name, desc in standard_categories:
        conn.execute(
            "INSERT OR IGNORE INTO question_categories (category_name, description) VALUES (?, ?)",
            (name, desc),
        )

    # Seed standard evaluation templates
    standard_evals = [
        ("What percentage of your practice role involves cancer medications?", "practice_profile", "percentage"),
        ("What is your primary practice type?", "practice_profile", "single_select"),
        ("What is your role in the retail or community setting?", "practice_profile", "single_select"),
        ("What changes do you intend to implement as a result of this activity?", "intended_change", "multi_select"),
        ("What barriers do you anticipate in implementing these changes?", "barrier", "multi_select"),
    ]
    for q_text, category, resp_type in standard_evals:
        conn.execute(
            "INSERT OR IGNORE INTO evaluation_templates (question_text, eval_category, response_type) VALUES (?, ?, ?)",
            (q_text, category, resp_type),
        )

    conn.commit()
    conn.close()
