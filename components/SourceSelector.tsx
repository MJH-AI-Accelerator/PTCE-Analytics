"use client";

import type { DataSource } from "@/lib/parsers/types";
import { Database, Radio, Zap } from "lucide-react";

interface SourceSelectorProps {
  selected: DataSource | "auto";
  onChange: (source: DataSource | "auto") => void;
}

const sources: { value: DataSource | "auto"; label: string; description: string }[] = [
  { value: "auto", label: "Auto-Detect", description: "Automatically identify the file format" },
  { value: "array", label: "Array", description: "Live activity data with Survey sheet" },
  { value: "globalmeet", label: "GlobalMeet", description: "Webinar report with survey data" },
  { value: "pigeonhole", label: "Pigeonhole", description: "Pre/post poll data (2 files)" },
  { value: "snowflake_eval", label: "Snowflake Evaluation", description: "Live credit evaluation data" },
  { value: "snowflake_ondemand", label: "Snowflake On-Demand", description: "Combined assessment + evaluation" },
];

export default function SourceSelector({ selected, onChange }: SourceSelectorProps) {
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Select Data Source</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {sources.map((s) => (
          <button
            key={s.value}
            onClick={() => onChange(s.value)}
            className={`flex items-start gap-3 p-4 rounded-lg border-2 text-left transition-all ${
              selected === s.value
                ? "border-teal-500 bg-teal-50"
                : "border-gray-200 hover:border-teal-300 bg-white"
            }`}
          >
            <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
              selected === s.value ? "border-teal-500" : "border-gray-300"
            }`}>
              {selected === s.value && <div className="w-2 h-2 rounded-full bg-teal-500" />}
            </div>
            <div>
              <div className="font-medium text-navy-700">{s.label}</div>
              <div className="text-sm text-navy-400 mt-0.5">{s.description}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
