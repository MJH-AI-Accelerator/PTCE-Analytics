"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface HistogramProps {
  data: number[];
  binCount?: number;
  title?: string;
  color?: string;
  height?: number;
}

export default function Histogram({ data, binCount = 10, title, color = "#3b82f6", height = 250 }: HistogramProps) {
  if (data.length === 0) return <p className="text-navy-400 text-sm">No data to display.</p>;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const binWidth = (max - min) / binCount || 1;

  const bins = Array.from({ length: binCount }, (_, i) => ({
    range: `${Math.round(min + i * binWidth)}-${Math.round(min + (i + 1) * binWidth)}`,
    count: 0,
  }));

  for (const val of data) {
    const idx = Math.min(Math.floor((val - min) / binWidth), binCount - 1);
    if (idx >= 0) bins[idx].count++;
  }

  return (
    <div>
      {title && <h3 className="text-sm font-semibold text-navy-700 mb-2">{title}</h3>}
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={bins} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="range" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip />
          <Bar dataKey="count" fill={color} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
