"use client";

import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface BarChartProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any[];
  xKey: string;
  yKeys: { key: string; color: string; label?: string }[];
  title?: string;
  height?: number;
}

export default function BarChart({ data, xKey, yKeys, title, height = 300 }: BarChartProps) {
  if (data.length === 0) return <p className="text-navy-400 text-sm">No data to display.</p>;

  return (
    <div>
      {title && <h3 className="text-sm font-semibold text-navy-700 mb-2">{title}</h3>}
      <ResponsiveContainer width="100%" height={height}>
        <RechartsBarChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={xKey} tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip />
          <Legend />
          {yKeys.map((y) => (
            <Bar key={y.key} dataKey={y.key} fill={y.color} name={y.label ?? y.key} />
          ))}
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
}
