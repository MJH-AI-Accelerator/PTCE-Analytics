"use client";

import { CANONICAL_FIELDS } from "@/lib/column-mapper";
import { validateMapping, type ValidationResult } from "@/lib/validators";

interface ColumnMappingEditorProps {
  headers: string[];
  mapping: Record<string, string | null>;
  onMappingChange: (mapping: Record<string, string | null>) => void;
  onReset: () => void;
}

const FIELD_LABELS: Record<string, string> = {
  email: "Email",
  first_name: "First Name",
  last_name: "Last Name",
  employer: "Employer",
  practice_setting: "Practice Setting",
  role: "Role",
  activity_id: "Activity ID",
  activity_name: "Activity Name",
  activity_date: "Activity Date",
  activity_type: "Activity Type",
  pre_score: "Pre-Test Score",
  post_score: "Post-Test Score",
  pre_confidence: "Pre-Confidence",
  post_confidence: "Post-Confidence",
  comments: "Comments",
  therapeutic_area: "Therapeutic Area",
  disease_state: "Disease State",
};

export default function ColumnMappingEditor({
  headers,
  mapping,
  onMappingChange,
  onReset,
}: ColumnMappingEditorProps) {
  const validation: ValidationResult = validateMapping(mapping);

  const handleChange = (field: string, value: string) => {
    onMappingChange({ ...mapping, [field]: value || null });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Column Mapping</h3>
        <button
          onClick={onReset}
          className="text-sm text-teal-600 hover:text-teal-800"
        >
          Reset to Auto-Detected
        </button>
      </div>

      {validation.errors.length > 0 && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          {validation.errors.map((e, i) => (
            <p key={i} className="text-red-700 text-sm">{e}</p>
          ))}
        </div>
      )}

      {validation.warnings.length > 0 && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          {validation.warnings.map((w, i) => (
            <p key={i} className="text-yellow-700 text-sm">{w}</p>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {CANONICAL_FIELDS.map((field) => (
          <div key={field} className="flex items-center gap-3">
            <label className="w-40 text-sm font-medium text-navy-600 shrink-0">
              {FIELD_LABELS[field] || field}
            </label>
            <select
              value={mapping[field] ?? ""}
              onChange={(e) => handleChange(field, e.target.value)}
              className="flex-1 border rounded-lg px-3 py-1.5 text-sm bg-white"
            >
              <option value="">-- Not mapped --</option>
              {headers.map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}
