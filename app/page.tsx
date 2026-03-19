import { getDashboardMetrics } from "@/lib/queries/dashboard";
import MetricCard from "@/components/MetricCard";
import DashboardCharts from "@/components/DashboardCharts";
import { Users, BookOpen, FolderOpen, TrendingUp } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  let metrics = { totalLearners: 0, totalParticipations: 0, totalActivities: 0, avgScoreChange: null as number | null };

  try {
    metrics = await getDashboardMetrics();
  } catch {
    // Supabase not configured yet — show empty state
  }

  const isEmpty = metrics.totalLearners === 0 && metrics.totalActivities === 0;

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">PTCE Learner Analytics Dashboard</h1>
      <p className="text-navy-400 mb-8">
        Welcome to the PTCE Learner Data Longitudinal Analysis Platform
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard title="Total Learners" value={metrics.totalLearners} icon={Users} />
        <MetricCard title="Total Participations" value={metrics.totalParticipations} icon={BookOpen} />
        <MetricCard title="Activities Tracked" value={metrics.totalActivities} icon={FolderOpen} />
        <MetricCard
          title="Avg Score Change"
          value={metrics.avgScoreChange !== null ? `${metrics.avgScoreChange}%` : "N/A"}
          icon={TrendingUp}
        />
      </div>

      {isEmpty ? (
        <div className="card text-center mt-8">
          <p className="text-navy-400 mb-4">
            No data imported yet. Go to Data Import to get started.
          </p>
          <Link
            href="/data-import"
            className="btn-primary inline-block"
          >
            Import Data
          </Link>
        </div>
      ) : (
        <DashboardCharts />
      )}
    </div>
  );
}
