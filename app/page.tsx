import { getDashboardMetrics } from "@/lib/queries/dashboard";
import MetricCard from "@/components/MetricCard";
import DashboardCharts from "@/components/DashboardCharts";
import { Users, FolderOpen, TrendingUp } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  let metrics = { totalLearners: 0, totalParticipations: 0, totalActivities: 0, avgScoreChange: null as number | null };

  try {
    metrics = await getDashboardMetrics();
  } catch {
    // Supabase not configured yet — show empty state
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">PTCE Learner Analytics Dashboard</h1>
      <p className="text-navy-400 mb-8">
        Welcome to the PTCE Learner Data Longitudinal Analysis Platform
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <MetricCard title="Total Learners" value={metrics.totalLearners} icon={Users} />
        <MetricCard title="Activities Tracked" value={metrics.totalActivities} icon={FolderOpen} />
        <MetricCard
          title="Avg Score Change"
          value={metrics.avgScoreChange !== null ? `${metrics.avgScoreChange}%` : "N/A"}
          icon={TrendingUp}
        />
      </div>

      <DashboardCharts />
    </div>
  );
}
