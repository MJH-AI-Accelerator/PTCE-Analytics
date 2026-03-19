"use client";

import { LineChart as RechartsLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface LineChartProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any[];
  xKey: string;
  yKeys: { key: string; color: string; label?: string }[];
  title?: string;
  height?: number;
}

export default function LineChart({ data, xKey, yKeys, title, height = 300 }: LineChartProps) {
  if (data.length === 0) return <p className="text-navy-400 text-sm">No data to display.</p>;

  return (
    <div>
      {title && <h3 className="text-sm font-semibold text-navy-700 mb-2">{title}</h3>}
      <ResponsiveContainer width="100%" height={height}>
        <RechartsLineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={xKey} tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip />
          <Legend />
          {yKeys.map((y) => (
            <Line key={y.key} type="monotone" dataKey={y.key} stroke={y.color} name={y.label ?? y.key} strokeWidth={2} />
          ))}
        </RechartsLineChart>
      </ResponsiveContainer>
    </div>
  );
}
