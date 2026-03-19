export interface Learner {
  id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
  employer_raw: string | null;
  employer_normalized: string | null;
  practice_setting: string | null;
  role: string | null;
  created_at: string;
  updated_at: string;
}

export interface Activity {
  activity_id: string;
  activity_name: string;
  activity_type: string | null;
  activity_date: string | null;
  therapeutic_area: string | null;
  disease_state: string | null;
  sponsor: string | null;
  accreditation_type: string | null;
  credit_hours: number | null;
  target_audience: string | null;
  description: string | null;
  created_at: string;
}

export interface LearningObjective {
  id: number;
  activity_id: string;
  objective_number: number | null;
  objective_text: string;
}

export interface Question {
  id: number;
  activity_id: string;
  question_number: number | null;
  question_text: string;
  question_type: "assessment" | "confidence" | "evaluation" | "pulse";
  question_category: string | null;
  correct_answer: string | null;
  objective_id: number | null;
}

export interface QuestionCategory {
  id: number;
  category_name: string;
  description: string | null;
}

export interface Participation {
  id: number;
  learner_id: number;
  activity_id: string;
  participation_date: string | null;
  pre_score: number | null;
  post_score: number | null;
  score_change: number | null;
  pre_confidence_avg: number | null;
  post_confidence_avg: number | null;
  confidence_change: number | null;
  comments: string | null;
  created_at: string;
}

export interface QuestionResponse {
  id: number;
  participation_id: number;
  question_id: number;
  phase: "pre" | "post";
  learner_answer: string | null;
  is_correct: boolean | null;
  numeric_value: number | null;
}

export interface EvaluationResponse {
  id: number;
  participation_id: number;
  question_id: number | null;
  eval_question_text: string;
  eval_category: "practice_profile" | "intended_change" | "barrier" | "demographic" | "custom" | null;
  response_text: string | null;
  response_numeric: number | null;
}

export interface EvaluationTemplate {
  id: number;
  question_text: string;
  eval_category: string;
  response_type: "text" | "single_select" | "multi_select" | "percentage" | "free_text";
  is_standard: boolean;
}

export interface EmployerAlias {
  id: number;
  raw_name: string;
  canonical_name: string;
  match_method: string | null;
  confidence: number | null;
  reviewed: boolean;
  created_at: string;
}

export interface NormalizationLog {
  id: number;
  field_name: string;
  original_value: string | null;
  normalized_value: string | null;
  method: string | null;
  created_at: string;
}

export interface RoleData {
  id: number;
  participation_id: number;
  role_field: string;
  role_value: string | null;
  role_percentage: number | null;
}

export type Database = {
  public: {
    Tables: {
      learners: { Row: Learner; Insert: Omit<Learner, "id" | "created_at" | "updated_at">; Update: Partial<Omit<Learner, "id">> };
      activities: { Row: Activity; Insert: Omit<Activity, "created_at">; Update: Partial<Activity> };
      learning_objectives: { Row: LearningObjective; Insert: Omit<LearningObjective, "id">; Update: Partial<Omit<LearningObjective, "id">> };
      questions: { Row: Question; Insert: Omit<Question, "id">; Update: Partial<Omit<Question, "id">> };
      question_categories: { Row: QuestionCategory; Insert: Omit<QuestionCategory, "id">; Update: Partial<Omit<QuestionCategory, "id">> };
      participations: { Row: Participation; Insert: Omit<Participation, "id" | "created_at">; Update: Partial<Omit<Participation, "id">> };
      question_responses: { Row: QuestionResponse; Insert: Omit<QuestionResponse, "id">; Update: Partial<Omit<QuestionResponse, "id">> };
      evaluation_responses: { Row: EvaluationResponse; Insert: Omit<EvaluationResponse, "id">; Update: Partial<Omit<EvaluationResponse, "id">> };
      evaluation_templates: { Row: EvaluationTemplate; Insert: Omit<EvaluationTemplate, "id">; Update: Partial<Omit<EvaluationTemplate, "id">> };
      employer_aliases: { Row: EmployerAlias; Insert: Omit<EmployerAlias, "id" | "created_at">; Update: Partial<Omit<EmployerAlias, "id">> };
      normalization_log: { Row: NormalizationLog; Insert: Omit<NormalizationLog, "id" | "created_at">; Update: Partial<Omit<NormalizationLog, "id">> };
      role_data: { Row: RoleData; Insert: Omit<RoleData, "id">; Update: Partial<Omit<RoleData, "id">> };
    };
  };
};
