-- PTCE Analytics — Import Pipeline Schema Extension

-- Email aliases for cross-platform matching
CREATE TABLE email_aliases (
    id BIGSERIAL PRIMARY KEY,
    primary_email TEXT NOT NULL REFERENCES learners(email),
    alias_email TEXT NOT NULL UNIQUE,
    confidence TEXT NOT NULL CHECK (confidence IN ('medium', 'high')),
    reviewed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_email_aliases_primary ON email_aliases(primary_email);
CREATE INDEX idx_email_aliases_alias ON email_aliases(alias_email);
CREATE INDEX idx_email_aliases_unreviewed ON email_aliases(reviewed) WHERE reviewed = FALSE;

-- Presenter questions (Q&A from learners during live sessions)
CREATE TABLE presenter_questions (
    id BIGSERIAL PRIMARY KEY,
    activity_id TEXT NOT NULL REFERENCES activities(activity_id),
    question_number INTEGER NOT NULL,
    question_text TEXT NOT NULL
);

CREATE INDEX idx_presenter_questions_activity ON presenter_questions(activity_id);

-- Presenter responses (learner answers to presenter Q&A)
CREATE TABLE presenter_responses (
    id BIGSERIAL PRIMARY KEY,
    presenter_question_id BIGINT NOT NULL REFERENCES presenter_questions(id),
    participation_id BIGINT NOT NULL REFERENCES participations(id),
    response_text TEXT
);

CREATE INDEX idx_presenter_responses_question ON presenter_responses(presenter_question_id);
CREATE INDEX idx_presenter_responses_participation ON presenter_responses(participation_id);

-- Import audit trail
CREATE TABLE import_batches (
    id BIGSERIAL PRIMARY KEY,
    activity_id TEXT NOT NULL REFERENCES activities(activity_id),
    data_source TEXT NOT NULL,
    source_file_name TEXT NOT NULL,
    imported_at TIMESTAMPTZ DEFAULT NOW(),
    learners_created INTEGER DEFAULT 0,
    learners_updated INTEGER DEFAULT 0,
    participations_created INTEGER DEFAULT 0,
    questions_created INTEGER DEFAULT 0,
    responses_created INTEGER DEFAULT 0,
    warnings JSONB DEFAULT '[]',
    errors JSONB DEFAULT '[]'
);

CREATE INDEX idx_import_batches_activity ON import_batches(activity_id);

-- Extend activities table with source tracking
ALTER TABLE activities ADD COLUMN IF NOT EXISTS data_source TEXT;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS source_file_name TEXT;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS import_date TIMESTAMPTZ;

-- Extend questions to support 'ars' type
ALTER TABLE questions DROP CONSTRAINT IF EXISTS questions_question_type_check;
ALTER TABLE questions ADD CONSTRAINT questions_question_type_check
    CHECK (question_type IN ('assessment', 'confidence', 'evaluation', 'pulse', 'ars'));

-- Extend evaluation_responses with faculty_name and additional categories
ALTER TABLE evaluation_responses DROP CONSTRAINT IF EXISTS evaluation_responses_eval_category_check;
ALTER TABLE evaluation_responses ADD CONSTRAINT evaluation_responses_eval_category_check
    CHECK (eval_category IN (
        'practice_profile', 'intended_change', 'barrier', 'demographic', 'custom',
        'faculty_rating', 'overall_rating', 'learning_objective_rating'
    ));
ALTER TABLE evaluation_responses ADD COLUMN IF NOT EXISTS faculty_name TEXT;
