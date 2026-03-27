"use server";

import { supabaseAdmin } from "@/lib/supabase-server";
import type { EmailAlias } from "@/lib/database.types";

export async function getEmailAliases(filter: "unreviewed" | "all"): Promise<EmailAlias[]> {
  const supabase = supabaseAdmin;
  let query = supabase
    .from("email_aliases")
    .select("*")
    .order("created_at", { ascending: false });

  if (filter === "unreviewed") {
    query = query.eq("reviewed", false);
  }

  const { data } = await query;
  return data ?? [];
}

export async function approveAlias(id: number): Promise<void> {
  const supabase = supabaseAdmin;
  await supabase
    .from("email_aliases")
    .update({ reviewed: true })
    .eq("id", id);
}

export async function rejectAlias(id: number): Promise<void> {
  const supabase = supabaseAdmin;
  await supabase
    .from("email_aliases")
    .delete()
    .eq("id", id);
}
