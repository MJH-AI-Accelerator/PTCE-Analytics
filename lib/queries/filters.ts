"use server";

import { getServiceClient } from "@/lib/supabase";

export interface FilterOptions {
  employers: string[];
  therapeuticAreas: string[];
  diseaseStates: string[];
  years: string[];
  activityTypes: string[];
  practiceSettings: string[];
}

export async function getFilterOptions(): Promise<FilterOptions> {
  const supabase = getServiceClient();
  const [{ data: learners }, { data: activities }] = await Promise.all([
    supabase.from("learners").select("employer_normalized, practice_setting"),
    supabase.from("activities").select("therapeutic_area, disease_state, activity_type, activity_date"),
  ]);

  const unique = (arr: (string | null | undefined)[]) =>
    [...new Set(arr.filter((v): v is string => !!v))].sort();

  const years = unique(
    (activities ?? []).map((a) => a.activity_date?.slice(0, 4))
  );

  return {
    employers: unique((learners ?? []).map((l) => l.employer_normalized)),
    therapeuticAreas: unique((activities ?? []).map((a) => a.therapeutic_area)),
    diseaseStates: unique((activities ?? []).map((a) => a.disease_state)),
    years,
    activityTypes: unique((activities ?? []).map((a) => a.activity_type)),
    practiceSettings: unique((learners ?? []).map((l) => l.practice_setting)),
  };
}
