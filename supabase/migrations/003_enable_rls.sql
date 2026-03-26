-- ============================================================
-- Migration 003: Enable RLS on all public tables + policies
-- Applied manually via Supabase SQL Editor on 2026-03-26
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employer_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluation_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluation_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_objectives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.normalization_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presenter_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presenter_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_data ENABLE ROW LEVEL SECURITY;

-- Auto-enable RLS on future tables
CREATE OR REPLACE FUNCTION auto_enable_rls()
RETURNS event_trigger LANGUAGE plpgsql AS $$
DECLARE obj RECORD;
BEGIN
  FOR obj IN SELECT * FROM pg_event_trigger_ddl_commands()
    WHERE command_tag = 'CREATE TABLE' LOOP
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY;', obj.object_identity);
  END LOOP;
END;
$$;

DROP EVENT TRIGGER IF EXISTS enable_rls_on_create;
CREATE EVENT TRIGGER enable_rls_on_create ON ddl_command_end
  WHEN TAG IN ('CREATE TABLE') EXECUTE FUNCTION auto_enable_rls();

-- Read-only policies for authenticated users
CREATE POLICY "Authenticated users can read activities" ON public.activities FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read email_aliases" ON public.email_aliases FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read employer_aliases" ON public.employer_aliases FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read evaluation_responses" ON public.evaluation_responses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read evaluation_templates" ON public.evaluation_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read import_batches" ON public.import_batches FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read learners" ON public.learners FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read learning_objectives" ON public.learning_objectives FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read normalization_log" ON public.normalization_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read participations" ON public.participations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read presenter_questions" ON public.presenter_questions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read presenter_responses" ON public.presenter_responses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read question_categories" ON public.question_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read question_responses" ON public.question_responses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read questions" ON public.questions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read role_data" ON public.role_data FOR SELECT TO authenticated USING (true);

-- Write policies for admin pages (employer_aliases and email_aliases)
CREATE POLICY "Authenticated users can insert employer_aliases" ON public.employer_aliases FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update employer_aliases" ON public.employer_aliases FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete employer_aliases" ON public.employer_aliases FOR DELETE TO authenticated USING (true);
CREATE POLICY "Authenticated users can update email_aliases" ON public.email_aliases FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete email_aliases" ON public.email_aliases FOR DELETE TO authenticated USING (true);
