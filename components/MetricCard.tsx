import { LucideIcon } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
}

export default function MetricCard({ title, value, subtitle, icon: Icon }: MetricCardProps) {
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-navy-400">{title}</span>
        <div className="p-2 bg-teal-50 rounded-lg">
          <Icon size={18} className="text-teal-500" />
        </div>
      </div>
      <div className="text-3xl font-bold text-navy-800">{value}</div>
      {subtitle && <p className="text-sm text-navy-300 mt-1">{subtitle}</p>}
    </div>
  );
}
