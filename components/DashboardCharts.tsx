"use client";

import { useEffect, useState } from "react";
import { getDashboardChartData, type DashboardChartData } from "@/lib/queries/dashboard-charts";
import Histogram from "@/components/charts/Histogram";
import BarChart from "@/components/charts/BarChart";

export default function DashboardCharts() {
  const [data, setData] = useState<DashboardChartData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDashboardChartData().then((d) => {
      setData(d);
      setLoading(false);
    });
  }, []);

  if (loading || !data) return null;
  if (data.scoreChanges.length === 0 && data.confChanges.length === 0) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
      <div className="card">
        <Histogram data={data.scoreChanges} title="Score Change Distribution" color="#00B4A6" />
      </div>
      <div className="card">
        <Histogram data={data.confChanges} title="Confidence Change Distribution" color="#F7941D" />
      </div>
      <div className="card">
        <BarChart data={data.yearlyData} xKey="year" yKeys={[{ key: "avg_change", color: "#1B2A4A", label: "Avg Score Change" }]} title="Year-over-Year" />
      </div>
      <div className="card">
        <BarChart data={data.employerData} xKey="employer" yKeys={[{ key: "avg_change", color: "#00B4A6", label: "Avg Score Change" }]} title="Top 10 Employers" />
      </div>
    </div>
  );
}
