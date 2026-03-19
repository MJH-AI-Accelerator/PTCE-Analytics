interface LoadingSkeletonProps {
  variant?: "card" | "table" | "chart" | "text";
  count?: number;
  className?: string;
}

function SkeletonCard() {
  return (
    <div className="card animate-pulse">
      <div className="h-4 bg-navy-100 rounded w-1/3 mb-4" />
      <div className="h-8 bg-navy-100 rounded w-1/2 mb-2" />
      <div className="h-3 bg-navy-100 rounded w-2/3" />
    </div>
  );
}

function SkeletonTable() {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 animate-pulse">
      <div className="h-10 bg-navy-50 rounded-t-lg" />
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-4 p-4 border-t">
          <div className="h-4 bg-navy-100 rounded flex-1" />
          <div className="h-4 bg-navy-100 rounded flex-1" />
          <div className="h-4 bg-navy-100 rounded w-20" />
        </div>
      ))}
    </div>
  );
}

function SkeletonChart() {
  return (
    <div className="card animate-pulse">
      <div className="h-4 bg-navy-100 rounded w-1/4 mb-4" />
      <div className="h-48 bg-navy-50 rounded" />
    </div>
  );
}

function SkeletonText() {
  return (
    <div className="animate-pulse space-y-2">
      <div className="h-4 bg-navy-100 rounded w-3/4" />
      <div className="h-4 bg-navy-100 rounded w-1/2" />
    </div>
  );
}

const variants = { card: SkeletonCard, table: SkeletonTable, chart: SkeletonChart, text: SkeletonText };

export default function LoadingSkeleton({ variant = "card", count = 1, className }: LoadingSkeletonProps) {
  const Component = variants[variant];
  return (
    <div className={className}>
      {Array.from({ length: count }).map((_, i) => (
        <Component key={i} />
      ))}
    </div>
  );
}
