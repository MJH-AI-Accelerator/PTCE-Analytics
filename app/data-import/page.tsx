"use client";

import { useState } from "react";
import FileUploader from "@/components/FileUploader";
import DataPreviewTable from "@/components/DataPreviewTable";
import ColumnMappingEditor from "@/components/ColumnMappingEditor";
import { parseFile, type ParsedFile } from "@/lib/file-parser";
import { detectColumns } from "@/lib/column-mapper";
import { validateMapping } from "@/lib/validators";
import { importData } from "./actions";
import type { ActivityMetadata } from "@/lib/ingestion/pipeline";

type Step = "upload" | "activity" | "mapping" | "import";

export default function DataImport() {
  const [step, setStep] = useState<Step>("upload");
  const [parsed, setParsed] = useState<ParsedFile | null>(null);
  const [fileName, setFileName] = useState("");
  const [mapping, setMapping] = useState<Record<string, string | null>>({});
  const [autoMapping, setAutoMapping] = useState<Record<string, string | null>>({});
  const [activity, setActivity] = useState<ActivityMetadata>({
    activity_id: "",
    activity_name: "",
    activity_type: "",
    activity_date: "",
    therapeutic_area: "",
    disease_state: "",
    sponsor: "",
  });
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{
    learnersCreated: number;
    learnersUpdated: number;
    participationsCreated: number;
    errors: string[];
  } | null>(null);

  const handleFileLoaded = (buffer: ArrayBuffer, name: string) => {
    const data = parseFile(buffer);
    setParsed(data);
    setFileName(name);
    const detected = detectColumns(data.headers);
    setMapping(detected);
    setAutoMapping(detected);
    setStep("activity");
  };

  const handleImport = async () => {
    if (!parsed || !activity.activity_id || !activity.activity_name) return;
    setImporting(true);
    try {
      const res = await importData(parsed.rows, mapping, activity);
      setResult(res);
      setStep("import");
    } catch (err) {
      setResult({
        learnersCreated: 0,
        learnersUpdated: 0,
        participationsCreated: 0,
        errors: [err instanceof Error ? err.message : "Import failed"],
      });
      setStep("import");
    }
    setImporting(false);
  };

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold mb-6">Data Import</h1>

      {/* Step indicators */}
      <div className="flex gap-2 mb-8">
        {(["upload", "activity", "mapping", "import"] as Step[]).map((s, i) => (
          <div
            key={s}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${
              step === s
                ? "bg-teal-500 text-white"
                : i < ["upload", "activity", "mapping", "import"].indexOf(step)
                ? "bg-teal-100 text-teal-700"
                : "bg-navy-50 text-navy-300"
            }`}
          >
            <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs">
              {i + 1}
            </span>
            {s === "upload" ? "Upload" : s === "activity" ? "Activity Info" : s === "mapping" ? "Map Columns" : "Results"}
          </div>
        ))}
      </div>

      {/* Step 1: Upload */}
      {step === "upload" && <FileUploader onFileLoaded={handleFileLoaded} />}

      {/* Step 2: Activity Info + Preview */}
      {step === "activity" && parsed && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">File: {fileName}</h2>
              <span className="text-sm text-navy-400">
                {parsed.rows.length} rows, {parsed.headers.length} columns
              </span>
            </div>
            <DataPreviewTable headers={parsed.headers} rows={parsed.rows} />
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold mb-4">Activity Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-navy-600 mb-1">Activity ID *</label>
                <input
                  type="text"
                  value={activity.activity_id}
                  onChange={(e) => setActivity({ ...activity, activity_id: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  placeholder="e.g., ACT-2024-001"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-navy-600 mb-1">Activity Name *</label>
                <input
                  type="text"
                  value={activity.activity_name}
                  onChange={(e) => setActivity({ ...activity, activity_name: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-navy-600 mb-1">Activity Type</label>
                <select
                  value={activity.activity_type}
                  onChange={(e) => setActivity({ ...activity, activity_type: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
                >
                  <option value="">Select...</option>
                  <option value="Webinar">Webinar</option>
                  <option value="Live Event">Live Event</option>
                  <option value="Self-Study">Self-Study</option>
                  <option value="Certificate Program">Certificate Program</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-navy-600 mb-1">Activity Date</label>
                <input
                  type="date"
                  value={activity.activity_date}
                  onChange={(e) => setActivity({ ...activity, activity_date: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-navy-600 mb-1">Therapeutic Area</label>
                <input
                  type="text"
                  value={activity.therapeutic_area}
                  onChange={(e) => setActivity({ ...activity, therapeutic_area: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-navy-600 mb-1">Disease State</label>
                <input
                  type="text"
                  value={activity.disease_state}
                  onChange={(e) => setActivity({ ...activity, disease_state: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-navy-600 mb-1">Sponsor</label>
                <input
                  type="text"
                  value={activity.sponsor}
                  onChange={(e) => setActivity({ ...activity, sponsor: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep("upload")}
              className="px-4 py-2 border rounded-lg text-sm hover:bg-navy-50"
            >
              Back
            </button>
            <button
              onClick={() => setStep("mapping")}
              disabled={!activity.activity_id || !activity.activity_name}
              className="px-4 py-2 bg-teal-500 text-white rounded-lg text-sm hover:bg-teal-600 disabled:opacity-50"
            >
              Next: Map Columns
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Column Mapping */}
      {step === "mapping" && parsed && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <ColumnMappingEditor
              headers={parsed.headers}
              mapping={mapping}
              onMappingChange={setMapping}
              onReset={() => setMapping(autoMapping)}
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep("activity")}
              className="px-4 py-2 border rounded-lg text-sm hover:bg-navy-50"
            >
              Back
            </button>
            <button
              onClick={handleImport}
              disabled={!validateMapping(mapping).isValid || importing}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700 disabled:opacity-50"
            >
              {importing ? "Importing..." : "Import Data"}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Results */}
      {step === "import" && result && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold mb-4">Import Results</h2>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center p-4 bg-teal-50 rounded-lg">
              <div className="text-2xl font-bold text-teal-700">{result.learnersCreated}</div>
              <div className="text-sm text-teal-600">Learners Created</div>
            </div>
            <div className="text-center p-4 bg-teal-50 rounded-lg">
              <div className="text-2xl font-bold text-teal-700">{result.learnersUpdated}</div>
              <div className="text-sm text-teal-600">Learners Updated</div>
            </div>
            <div className="text-center p-4 bg-accent-50 rounded-lg">
              <div className="text-2xl font-bold text-accent-700">{result.participationsCreated}</div>
              <div className="text-sm text-accent-600">Participations</div>
            </div>
          </div>
          {result.errors.length > 0 && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="font-medium text-red-700 mb-2">Errors ({result.errors.length}):</p>
              <ul className="text-sm text-red-600 space-y-1">
                {result.errors.slice(0, 10).map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
                {result.errors.length > 10 && (
                  <li>...and {result.errors.length - 10} more</li>
                )}
              </ul>
            </div>
          )}
          <button
            onClick={() => {
              setStep("upload");
              setParsed(null);
              setResult(null);
            }}
            className="mt-4 px-4 py-2 bg-teal-500 text-white rounded-lg text-sm hover:bg-teal-600"
          >
            Import Another File
          </button>
        </div>
      )}
    </div>
  );
}
