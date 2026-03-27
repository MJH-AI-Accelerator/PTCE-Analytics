"use server";

import { supabaseAdmin } from "@/lib/supabase-server";
import * as ss from "simple-statistics";

export interface DescriptiveResult {
  metric: string;
  n: number;
  mean: number | null;
  median: number | null;
  stdDev: number | null;
  min: number | null;
  max: number | null;
  ci95: [number, number] | null;
}

export async function descriptiveStats(): Promise<DescriptiveResult[]> {
  const supabase = supabaseAdmin;
  const { data } = await supabase.from("participations").select("pre_score, post_score, score_change");
  if (!data) return [];

  const compute = (label: string, values: number[]): DescriptiveResult => {
    if (values.length === 0) return { metric: label, n: 0, mean: null, median: null, stdDev: null, min: null, max: null, ci95: null };
    const mean = ss.mean(values);
    const std = values.length > 1 ? ss.standardDeviation(values) : 0;
    const se = std / Math.sqrt(values.length);
    return {
      metric: label,
      n: values.length,
      mean: Math.round(mean * 100) / 100,
      median: Math.round(ss.median(values) * 100) / 100,
      stdDev: Math.round(std * 100) / 100,
      min: Math.round(ss.min(values) * 100) / 100,
      max: Math.round(ss.max(values) * 100) / 100,
      ci95: [Math.round((mean - 1.96 * se) * 100) / 100, Math.round((mean + 1.96 * se) * 100) / 100],
    };
  };

  return [
    compute("Pre Score", data.filter((d) => d.pre_score != null).map((d) => d.pre_score!)),
    compute("Post Score", data.filter((d) => d.post_score != null).map((d) => d.post_score!)),
    compute("Score Change", data.filter((d) => d.score_change != null).map((d) => d.score_change!)),
  ];
}

export interface TTestResult {
  tStatistic: number;
  pValue: number;
  degreesOfFreedom: number;
  cohensD: number;
  interpretation: string;
}

export async function pairedTTest(): Promise<TTestResult | null> {
  const supabase = supabaseAdmin;
  const { data } = await supabase.from("participations").select("pre_score, post_score").not("pre_score", "is", null).not("post_score", "is", null);
  if (!data || data.length < 2) return null;

  const pre = data.map((d) => d.pre_score!);
  const post = data.map((d) => d.post_score!);
  const diffs = pre.map((p, i) => post[i] - p);
  const n = diffs.length;
  const meanDiff = ss.mean(diffs);
  const sdDiff = ss.standardDeviation(diffs);
  const t = meanDiff / (sdDiff / Math.sqrt(n));
  const df = n - 1;

  // Approximate p-value using normal approximation for large samples
  const z = Math.abs(t);
  const p = 2 * (1 - normalCDF(z));

  const cohensD = sdDiff > 0 ? Math.abs(meanDiff / sdDiff) : 0;
  const effectLabel = cohensD < 0.2 ? "negligible" : cohensD < 0.5 ? "small" : cohensD < 0.8 ? "medium" : "large";
  const sig = p < 0.001 ? "p < 0.001" : p < 0.01 ? "p < 0.01" : p < 0.05 ? "p < 0.05" : "not significant";

  return {
    tStatistic: Math.round(t * 1000) / 1000,
    pValue: Math.round(p * 10000) / 10000,
    degreesOfFreedom: df,
    cohensD: Math.round(cohensD * 1000) / 1000,
    interpretation: `${sig}, ${effectLabel} effect size (Cohen's d = ${Math.round(cohensD * 100) / 100})`,
  };
}

function normalCDF(x: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429;
  const p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1.0 + sign * y);
}
