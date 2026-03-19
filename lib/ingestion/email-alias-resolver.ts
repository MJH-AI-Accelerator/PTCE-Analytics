import { SupabaseClient } from "@supabase/supabase-js";
import Fuse from "fuse.js";

/**
 * Resolve an email to its primary email using the email_aliases table.
 * If no alias exists, returns the original email.
 */
export async function resolveEmailAlias(
  supabase: SupabaseClient,
  email: string
): Promise<string> {
  const normalizedEmail = email.trim().toLowerCase();

  // Check if this email is an alias
  const { data: alias } = await supabase
    .from("email_aliases")
    .select("primary_email")
    .eq("alias_email", normalizedEmail)
    .eq("reviewed", true)
    .single();

  if (alias) return alias.primary_email;

  return normalizedEmail;
}

/**
 * Find potential email matches for unmatched learners using name-based fuzzy matching.
 * Returns medium/high confidence matches for admin review.
 */
export async function findPotentialEmailMatches(
  supabase: SupabaseClient,
  unmatchedEmail: string,
  firstName: string | null,
  lastName: string | null
): Promise<{ primaryEmail: string; confidence: "medium" | "high" } | null> {
  if (!firstName && !lastName) return null;

  const normalizedEmail = unmatchedEmail.trim().toLowerCase();

  // Check if already exists as a learner
  const { data: existingLearner } = await supabase
    .from("learners")
    .select("email")
    .eq("email", normalizedEmail)
    .single();

  if (existingLearner) return null; // Already a known learner

  // Check if already flagged as an alias
  const { data: existingAlias } = await supabase
    .from("email_aliases")
    .select("id")
    .eq("alias_email", normalizedEmail)
    .single();

  if (existingAlias) return null; // Already flagged

  // Try name-based matching against existing learners
  const { data: allLearners } = await supabase
    .from("learners")
    .select("email, first_name, last_name");

  if (!allLearners || allLearners.length === 0) return null;

  // High confidence: name extracted from email matches an existing learner
  const emailNameParts = extractNameFromEmail(normalizedEmail);
  if (emailNameParts) {
    const highMatch = allLearners.find((l) => {
      if (!l.first_name || !l.last_name) return false;
      const firstMatch = l.first_name.toLowerCase() === emailNameParts.firstName.toLowerCase();
      const lastMatch = l.last_name.toLowerCase() === emailNameParts.lastName.toLowerCase();
      return firstMatch && lastMatch;
    });
    if (highMatch) {
      return { primaryEmail: highMatch.email, confidence: "high" };
    }
  }

  // Medium confidence: provided name matches existing learner name
  if (firstName && lastName) {
    const mediumMatch = allLearners.find((l) => {
      if (!l.last_name) return false;
      const lastMatch = l.last_name.toLowerCase() === lastName.toLowerCase();
      if (!lastMatch) return false;
      // First name partial match
      if (l.first_name) {
        return l.first_name.toLowerCase() === firstName.toLowerCase() ||
          l.first_name.toLowerCase().startsWith(firstName.toLowerCase().slice(0, 3));
      }
      return false;
    });
    if (mediumMatch && mediumMatch.email !== normalizedEmail) {
      return { primaryEmail: mediumMatch.email, confidence: "medium" };
    }
  }

  return null;
}

/**
 * Flag a potential email match for admin review.
 */
export async function flagEmailMatch(
  supabase: SupabaseClient,
  primaryEmail: string,
  aliasEmail: string,
  confidence: "medium" | "high"
): Promise<void> {
  await supabase.from("email_aliases").upsert(
    {
      primary_email: primaryEmail,
      alias_email: aliasEmail.trim().toLowerCase(),
      confidence,
      reviewed: false,
    },
    { onConflict: "alias_email" }
  );
}

/** Extract first/last name from email address (e.g., "john.doe@gmail.com" → {firstName: "john", lastName: "doe"}) */
function extractNameFromEmail(email: string): { firstName: string; lastName: string } | null {
  const local = email.split("@")[0];
  if (!local) return null;

  // Try "first.last" or "first_last" patterns
  const parts = local.split(/[._]/);
  if (parts.length >= 2) {
    const firstName = parts[0];
    const lastName = parts[parts.length - 1];
    // Filter out obviously non-name parts (numbers, short codes)
    if (firstName.length >= 2 && lastName.length >= 2 && !/\d/.test(firstName) && !/\d/.test(lastName)) {
      return { firstName, lastName };
    }
  }

  return null;
}
