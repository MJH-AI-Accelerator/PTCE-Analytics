"use server";

import { supabaseAdmin } from "@/lib/supabase-server";
import type { EmployerAlias, NormalizationLog } from "@/lib/database.types";

export async function getEmployerAliases(): Promise<EmployerAlias[]> {
  const supabase = supabaseAdmin;
  const { data } = await supabase
    .from("employer_aliases")
    .select("*")
    .order("canonical_name");
  return data ?? [];
}

export async function getUnmatchedEmployers(): Promise<string[]> {
  const supabase = supabaseAdmin;
  const { data: learners } = await supabase
    .from("learners")
    .select("employer_raw")
    .not("employer_raw", "is", null);

  const { data: aliases } = await supabase
    .from("employer_aliases")
    .select("raw_name");

  const aliasSet = new Set((aliases ?? []).map((a) => a.raw_name.toLowerCase()));
  const unmatched = new Set<string>();

  for (const l of learners ?? []) {
    if (l.employer_raw && !aliasSet.has(l.employer_raw.toLowerCase().trim())) {
      unmatched.add(l.employer_raw);
    }
  }

  return Array.from(unmatched).sort();
}

export async function getCanonicalEmployers(): Promise<string[]> {
  const supabase = supabaseAdmin;
  const { data } = await supabase
    .from("learners")
    .select("employer_normalized")
    .not("employer_normalized", "is", null);

  const unique = new Set((data ?? []).map((d) => d.employer_normalized!));
  return Array.from(unique).sort();
}

export async function getNormalizationLog(field?: string): Promise<NormalizationLog[]> {
  const supabase = supabaseAdmin;
  let query = supabase.from("normalization_log").select("*").order("created_at", { ascending: false });
  if (field) query = query.eq("field_name", field);
  const { data } = await query.limit(200);
  return data ?? [];
}
