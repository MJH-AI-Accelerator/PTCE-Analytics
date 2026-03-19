import Fuse from "fuse.js";
import { SupabaseClient } from "@supabase/supabase-js";
import type { EmployerAlias } from "@/lib/database.types";

interface MatchResult {
  match: string | null;
  score: number;
  method: "exact" | "fuzzy" | "none";
}

export function findBestMatch(
  rawName: string,
  canonicalNames: string[],
  threshold = 0.4
): MatchResult {
  const cleaned = rawName.trim().toLowerCase();
  if (!cleaned) return { match: null, score: 0, method: "none" };

  // Exact match
  const exact = canonicalNames.find((n) => n.toLowerCase() === cleaned);
  if (exact) return { match: exact, score: 1, method: "exact" };

  // Fuzzy match
  if (canonicalNames.length === 0) return { match: null, score: 0, method: "none" };

  const fuse = new Fuse(canonicalNames, {
    threshold,
    includeScore: true,
  });

  const results = fuse.search(rawName);
  if (results.length > 0 && results[0].score !== undefined) {
    return {
      match: results[0].item,
      score: 1 - results[0].score,
      method: "fuzzy",
    };
  }

  return { match: null, score: 0, method: "none" };
}

export async function buildAliasTable(
  supabase: SupabaseClient
): Promise<EmployerAlias[]> {
  const { data } = await supabase
    .from("employer_aliases")
    .select("*")
    .order("canonical_name");
  return data ?? [];
}

export async function applyAlias(
  supabase: SupabaseClient,
  rawName: string,
  canonicalName: string,
  method = "manual",
  confidence = 1.0
) {
  await supabase.from("employer_aliases").upsert(
    {
      raw_name: rawName.toLowerCase().trim(),
      canonical_name: canonicalName,
      match_method: method,
      confidence,
      reviewed: true,
    },
    { onConflict: "raw_name" }
  );

  // Update learners with this raw name
  await supabase
    .from("learners")
    .update({ employer_normalized: canonicalName })
    .ilike("employer_raw", rawName.trim());
}
