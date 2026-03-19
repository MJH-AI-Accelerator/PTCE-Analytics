"use client";

import { useEffect, useState } from "react";
import { getFilterOptions, type FilterOptions } from "@/lib/queries/filters";

export interface Filters {
  employers: string[];
  therapeuticAreas: string[];
  diseaseStates: string[];
  years: string[];
  activityTypes: string[];
  practiceSettings: string[];
}

const EMPTY_FILTERS: Filters = { employers: [], therapeuticAreas: [], diseaseStates: [], years: [], activityTypes: [], practiceSettings: [] };

interface FilterPanelProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
}

export default function FilterPanel({ filters, onChange }: FilterPanelProps) {
  const [options, setOptions] = useState<FilterOptions | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    getFilterOptions().then(setOptions);
  }, []);

  const handleMultiSelect = (key: keyof Filters, value: string) => {
    const current = filters[key] as string[];
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    onChange({ ...filters, [key]: next });
  };

  if (!options) return null;

  const selects: { key: keyof Filters; label: string; options: string[] }[] = [
    { key: "employers", label: "Employer", options: options.employers },
    { key: "therapeuticAreas", label: "Therapeutic Area", options: options.therapeuticAreas },
    { key: "diseaseStates", label: "Disease State", options: options.diseaseStates },
    { key: "practiceSettings", label: "Practice Setting", options: options.practiceSettings },
    { key: "years", label: "Year", options: options.years },
    { key: "activityTypes", label: "Activity Type", options: options.activityTypes },
  ];

  const hasFilters = Object.values(filters).some((v) => v.length > 0);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => setCollapsed(!collapsed)} className="text-sm font-semibold text-navy-600">
          Filters {collapsed ? "▸" : "▾"}
        </button>
        {hasFilters && (
          <button onClick={() => onChange(EMPTY_FILTERS)} className="text-sm text-red-600 hover:text-red-800">
            Clear All
          </button>
        )}
      </div>
      {!collapsed && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {selects.map((s) => (
            <div key={s.key}>
              <label className="block text-xs font-medium text-navy-400 mb-1">{s.label}</label>
              <select
                multiple
                value={filters[s.key]}
                onChange={(e) => {
                  const selected = Array.from(e.target.selectedOptions, (o) => o.value);
                  onChange({ ...filters, [s.key]: selected });
                }}
                className="w-full border rounded text-xs p-1 h-20"
              >
                {s.options.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export { EMPTY_FILTERS };
