"use client";

import { useEffect, useState } from "react";
import { descriptiveStats, pairedTTest, type DescriptiveResult, type TTestResult } from "@/lib/analytics/statistics";

export default function StatisticalTests() {
  const [desc, setDesc] = useState<DescriptiveResult[]>([]);
  const [ttest, setTtest] = useState<TTestResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([descriptiveStats(), pairedTTest()]).then(([d, t]) => {
      setDesc(d);
      setTtest(t);
      setLoading(false);
    });
  }, []);

  if (loading) return <div><h1 className="text-2xl font-bold mb-6">Statistical Tests</h1><p className="text-navy-400">Loading...</p></div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Statistical Tests</h1>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Descriptive Statistics</h2>
        {desc.length === 0 || desc.every((d) => d.n === 0) ? (
          <p className="text-navy-400">No data available for statistical analysis.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-navy-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-navy-500">Metric</th>
                  <th className="px-4 py-2 text-left font-medium text-navy-500">N</th>
                  <th className="px-4 py-2 text-left font-medium text-navy-500">Mean</th>
                  <th className="px-4 py-2 text-left font-medium text-navy-500">Median</th>
                  <th className="px-4 py-2 text-left font-medium text-navy-500">Std Dev</th>
                  <th className="px-4 py-2 text-left font-medium text-navy-500">Min</th>
                  <th className="px-4 py-2 text-left font-medium text-navy-500">Max</th>
                  <th className="px-4 py-2 text-left font-medium text-navy-500">95% CI</th>
                </tr>
              </thead>
              <tbody>
                {desc.map((d) => (
                  <tr key={d.metric} className="border-t">
                    <td className="px-4 py-2 font-medium">{d.metric}</td>
                    <td className="px-4 py-2">{d.n}</td>
                    <td className="px-4 py-2">{d.mean ?? "—"}</td>
                    <td className="px-4 py-2">{d.median ?? "—"}</td>
                    <td className="px-4 py-2">{d.stdDev ?? "—"}</td>
                    <td className="px-4 py-2">{d.min ?? "—"}</td>
                    <td className="px-4 py-2">{d.max ?? "—"}</td>
                    <td className="px-4 py-2">{d.ci95 ? `[${d.ci95[0]}, ${d.ci95[1]}]` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Paired t-Test (Pre vs Post Score)</h2>
        {!ttest ? (
          <p className="text-navy-400">Insufficient data for paired t-test (need at least 2 paired observations).</p>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 bg-navy-50 rounded-lg text-center">
                <div className="text-xl font-bold">{ttest.tStatistic}</div>
                <div className="text-xs text-navy-400">t-Statistic</div>
              </div>
              <div className="p-3 bg-navy-50 rounded-lg text-center">
                <div className={`text-xl font-bold ${ttest.pValue < 0.05 ? "text-teal-600" : ""}`}>{ttest.pValue < 0.001 ? "< 0.001" : ttest.pValue}</div>
                <div className="text-xs text-navy-400">p-Value</div>
              </div>
              <div className="p-3 bg-navy-50 rounded-lg text-center">
                <div className="text-xl font-bold">{ttest.degreesOfFreedom}</div>
                <div className="text-xs text-navy-400">df</div>
              </div>
              <div className="p-3 bg-navy-50 rounded-lg text-center">
                <div className="text-xl font-bold">{ttest.cohensD}</div>
                <div className="text-xs text-navy-400">Cohen&apos;s d</div>
              </div>
            </div>
            <p className="text-sm text-navy-600 bg-teal-50 p-3 rounded-lg">{ttest.interpretation}</p>
          </div>
        )}
      </div>
    </div>
  );
}
