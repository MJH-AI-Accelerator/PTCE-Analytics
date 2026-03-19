import { SupabaseClient } from "@supabase/supabase-js";

export interface LearnerData {
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  employer_raw?: string | null;
  employer_normalized?: string | null;
  practice_setting?: string | null;
  role?: string | null;
}

export async function resolveOrCreateLearner(
  supabase: SupabaseClient,
  data: LearnerData
): Promise<number> {
  let email = data.email.trim().toLowerCase();
  if (!email) throw new Error("Email is required for learner identity resolution");

  // Check email aliases — resolve to primary email if this is a known alias
  try {
    const { data: alias } = await supabase
      .from("email_aliases")
      .select("primary_email")
      .eq("alias_email", email)
      .eq("reviewed", true)
      .single();

    if (alias) {
      email = alias.primary_email;
    }
  } catch {
    // email_aliases table may not exist yet — skip alias resolution
  }

  // Check if exists
  const { data: existing } = await supabase
    .from("learners")
    .select("id")
    .eq("email", email)
    .single();

  if (existing) {
    // Update non-null fields
    const updates: Record<string, unknown> = {};
    if (data.first_name) updates.first_name = data.first_name.trim();
    if (data.last_name) updates.last_name = data.last_name.trim();
    if (data.employer_raw) updates.employer_raw = data.employer_raw;
    if (data.employer_normalized) updates.employer_normalized = data.employer_normalized;
    if (data.practice_setting) updates.practice_setting = data.practice_setting;
    if (data.role) updates.role = data.role;

    if (Object.keys(updates).length > 0) {
      updates.updated_at = new Date().toISOString();
      await supabase.from("learners").update(updates).eq("id", existing.id);
    }
    return existing.id;
  }

  // Create new
  const { data: created, error } = await supabase
    .from("learners")
    .insert({
      email,
      first_name: data.first_name?.trim() ?? null,
      last_name: data.last_name?.trim() ?? null,
      employer_raw: data.employer_raw ?? null,
      employer_normalized: data.employer_normalized ?? null,
      practice_setting: data.practice_setting ?? null,
      role: data.role ?? null,
    })
    .select("id")
    .single();

  if (error) throw error;
  return created!.id;
}
