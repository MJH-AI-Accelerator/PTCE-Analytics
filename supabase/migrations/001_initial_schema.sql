-- PTCE Analytics — Initial Schema (PostgreSQL / Supabase)

CREATE TABLE learners (
    id BIGSERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    first_name TEXT,
    last_name TEXT,
    employer_raw TEXT,
    employer_normalized TEXT,
    practice_setting TEXT,
    role TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE activities (
    activity_id TEXT PRIMARY KEY,
    activity_name TEXT NOT NULL,
    activity_type TEXT,
    activity_date TEXT,
    therapeutic_area TEXT,
    disease_state TEXT,
    sponsor TEXT,
    accreditation_type TEXT,
    credit_hours NUMERIC,
    target_audience TEXT,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE learning_objectives (
    id BIGSERIAL PRIMARY KEY,
    activity_id TEXT NOT NULL REFERENCES activities(activity_id),
    objective_number INTEGER,
    objective_text TEXT NOT NULL
);

CREATE TABLE questions (
    id BIGSERIAL PRIMARY KEY,
    activity_id TEXT NOT NULL REFERENCES activities(activity_id),
    question_number INTEGER,
    question_text TEXT NOT NULL,
    question_type TEXT DEFAULT 'assessment'
        CHECK (question_type IN ('assessment', 'confidence', 'evaluation', 'pulse')),
    question_category TEXT,
    correct_answer TEXT,
    objective_id BIGINT REFERENCES learning_objectives(id)
);

CREATE TABLE question_categories (
    id BIGSERIAL PRIMARY KEY,
    category_name TEXT NOT NULL UNIQUE,
    description TEXT
);

CREATE TABLE participations (
    id BIGSERIAL PRIMARY KEY,
    learner_id BIGINT NOT NULL REFERENCES learners(id),
    activity_id TEXT NOT NULL REFERENCES activities(activity_id),
    participation_date TEXT,
    pre_score NUMERIC,
    post_score NUMERIC,
    score_change NUMERIC,
    pre_confidence_avg NUMERIC,
    post_confidence_avg NUMERIC,
    confidence_change NUMERIC,
    comments TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (learner_id, activity_id)
);

CREATE TABLE question_responses (
    id BIGSERIAL PRIMARY KEY,
    participation_id BIGINT NOT NULL REFERENCES participations(id),
    question_id BIGINT NOT NULL REFERENCES questions(id),
    phase TEXT NOT NULL CHECK (phase IN ('pre', 'post')),
    learner_answer TEXT,
    is_correct BOOLEAN,
    numeric_value NUMERIC
);

CREATE TABLE evaluation_responses (
    id BIGSERIAL PRIMARY KEY,
    participation_id BIGINT NOT NULL REFERENCES participations(id),
    question_id BIGINT REFERENCES questions(id),
    eval_question_text TEXT NOT NULL,
    eval_category TEXT CHECK (eval_category IN (
        'practice_profile', 'intended_change', 'barrier', 'demographic', 'custom'
    )),
    response_text TEXT,
    response_numeric NUMERIC
);

CREATE TABLE evaluation_templates (
    id BIGSERIAL PRIMARY KEY,
    question_text TEXT NOT NULL,
    eval_category TEXT NOT NULL,
    response_type TEXT DEFAULT 'text'
        CHECK (response_type IN ('text', 'single_select', 'multi_select', 'percentage', 'free_text')),
    is_standard BOOLEAN DEFAULT TRUE
);

CREATE TABLE employer_aliases (
    id BIGSERIAL PRIMARY KEY,
    raw_name TEXT NOT NULL UNIQUE,
    canonical_name TEXT NOT NULL,
    match_method TEXT,
    confidence NUMERIC,
    reviewed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE normalization_log (
    id BIGSERIAL PRIMARY KEY,
    field_name TEXT NOT NULL,
    original_value TEXT,
    normalized_value TEXT,
    method TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE role_data (
    id BIGSERIAL PRIMARY KEY,
    participation_id BIGINT NOT NULL REFERENCES participations(id),
    role_field TEXT NOT NULL,
    role_value TEXT,
    role_percentage NUMERIC
);

-- Indexes
CREATE INDEX idx_learners_email ON learners(email);
CREATE INDEX idx_learners_employer ON learners(employer_normalized);
CREATE INDEX idx_participations_learner ON participations(learner_id);
CREATE INDEX idx_participations_activity ON participations(activity_id);
CREATE INDEX idx_questions_activity ON questions(activity_id);
CREATE INDEX idx_questions_text ON questions(question_text);
CREATE INDEX idx_question_responses_participation ON question_responses(participation_id);
CREATE INDEX idx_question_responses_question ON question_responses(question_id);
CREATE INDEX idx_question_responses_phase ON question_responses(phase);
CREATE INDEX idx_evaluation_responses_participation ON evaluation_responses(participation_id);
CREATE INDEX idx_evaluation_responses_category ON evaluation_responses(eval_category);
CREATE INDEX idx_questions_category ON questions(question_category);
CREATE INDEX idx_questions_type ON questions(question_type);

-- Seed question categories
INSERT INTO question_categories (category_name, description) VALUES
    ('Pathophysiology / Mechanism of Action', 'Questions about disease mechanisms and drug MOA'),
    ('Clinical Updates', 'Questions about recent clinical data, guidelines, and trial results'),
    ('Patient Recommendations', 'Questions about counseling, treatment selection, and patient care'),
    ('Disease Burden', 'Questions about epidemiology, prevalence, and impact of disease'),
    ('Role of the Pharmacist', 'Questions about pharmacist responsibilities and scope of practice');

-- Seed evaluation templates
INSERT INTO evaluation_templates (question_text, eval_category, response_type) VALUES
    ('What percentage of your practice role involves cancer medications?', 'practice_profile', 'percentage'),
    ('What is your primary practice type?', 'practice_profile', 'single_select'),
    ('What is your role in the retail or community setting?', 'practice_profile', 'single_select'),
    ('What changes do you intend to implement as a result of this activity?', 'intended_change', 'multi_select'),
    ('What barriers do you anticipate in implementing these changes?', 'barrier', 'multi_select');
