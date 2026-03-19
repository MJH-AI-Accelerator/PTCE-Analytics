"use client";

import { useState, useCallback } from "react";
import SourceSelector from "@/components/SourceSelector";
import MultiFileUploader, { type FileEntry } from "@/components/MultiFileUploader";
import AnswerKeyUploader from "@/components/AnswerKeyUploader";
import ParsePreview from "@/components/ParsePreview";
import { detectSource } from "@/lib/parsers/detect-source";
import { parseArrayFile } from "@/lib/parsers/array-parser";
import { parseGlobalMeetFile, mergeGlobalMeetFiles } from "@/lib/parsers/globalmeet-parser";
import { parsePigeonholeFiles } from "@/lib/parsers/pigeonhole-parser";
import { parseSnowflakeEvalFile } from "@/lib/parsers/snowflake-eval-parser";
import { parseSnowflakeOnDemandFile } from "@/lib/parsers/snowflake-ondemand-parser";
import { importParsedData } from "./actions";
import type { DataSource, ParsedActivityData, AnswerKeyEntry } from "@/lib/parsers/types";
import type { ActivityMetadata } from "@/lib/ingestion/pipeline";

type Step = "source" | "upload" | "answer-key" | "preview" | "activity" | "results";

const STEP_LABELS: Record<Step, string> = {
  source: "Source",
  upload: "Upload",
  "answer-key": "Answer Key",
  preview: "Preview",
  activity: "Activity Info",
  results: "Results",
};

const STEPS: Step[] = ["source", "upload", "answer-key", "preview", "activity", "results"];

export default function DataImport() {
  const [step, setStep] = useState<Step>("source");
  const [selectedSource, setSelectedSource] = useState<DataSource | "auto">("auto");
  const [detectedSource, setDetectedSource] = useState<DataSource | null>(null);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [parsed, setParsed] = useState<ParsedActivityData | null>(null);
  const [hasHighlighting, setHasHighlighting] = useState(false);
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
    questionsCreated: number;
    responsesCreated: number;
    evaluationResponsesCreated: number;
    emailAliasesFlagged: number;
    errors: string[];
    warnings: string[];
  } | null>(null);

  const effectiveSource = selectedSource === "auto" ? detectedSource : selectedSource;
  const needsTwoFiles = effectiveSource === "pigeonhole";
  const maxFiles = needsTwoFiles ? 2 : (effectiveSource === "globalmeet" ? 2 : 1);

  const handleFilesChange = useCallback((newFiles: FileEntry[]) => {
    setFiles(newFiles);

    // Auto-detect source from first file if in auto mode
    if (selectedSource === "auto" && newFiles.length > 0) {
      const detection = detectSource(newFiles[0].buffer);
      if (detection) {
        setDetectedSource(detection.source);
      }
    }
  }, [selectedSource]);

  const handleParse = useCallback(() => {
    if (!effectiveSource || files.length === 0) return;

    try {
      let result: ParsedActivityData;

      switch (effectiveSource) {
        case "array":
          result = parseArrayFile(files[0].buffer, files[0].name);
          setHasHighlighting(result.questions.some((q) => q.correctAnswer != null));
          break;
        case "globalmeet":
          if (files.length === 2) {
            const parsed1 = parseGlobalMeetFile(files[0].buffer, files[0].name);
            const parsed2 = parseGlobalMeetFile(files[1].buffer, files[1].name);
            result = mergeGlobalMeetFiles([parsed1, parsed2]);
          } else {
            result = parseGlobalMeetFile(files[0].buffer, files[0].name);
          }
          setHasHighlighting(false);
          break;
        case "pigeonhole":
          if (files.length < 2) {
            alert("Pigeonhole requires both pretest and posttest files");
            return;
          }
          result = parsePigeonholeFiles(files[0].buffer, files[1].buffer, files[0].name, files[1].name);
          setHasHighlighting(false);
          break;
        case "snowflake_eval":
          result = parseSnowflakeEvalFile(files[0].buffer, files[0].name);
          setHasHighlighting(false);
          break;
        case "snowflake_ondemand":
          result = parseSnowflakeOnDemandFile(files[0].buffer, files[0].name);
          setHasHighlighting(false);
          break;
        default:
          return;
      }

      setParsed(result);

      // Pre-populate activity metadata
      if (result.suggestedActivityName) {
        setActivity((prev) => ({
          ...prev,
          activity_name: prev.activity_name || result.suggestedActivityName || "",
        }));
      }

      // Skip answer key step if source has highlighting or is eval-only
      if (effectiveSource === "snowflake_eval" || (effectiveSource === "array" && result.questions.some((q) => q.correctAnswer))) {
        setStep("preview");
      } else {
        setStep("answer-key");
      }
    } catch (err) {
      alert(`Parse error: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }, [effectiveSource, files]);

  const handleAnswerKeyLoaded = useCallback((_entries: AnswerKeyEntry[]) => {
    // Answer key entries would be applied to parsed questions here
    // For now, advance to preview
    setStep("preview");
  }, []);

  const handleImport = async () => {
    if (!parsed || !activity.activity_id || !activity.activity_name) return;
    setImporting(true);
    try {
      // Serialize parsed data for server action (ArrayBuffers can't be sent)
      const res = await importParsedData(parsed, activity);
      setResult(res);
      setStep("results");
    } catch (err) {
      setResult({
        learnersCreated: 0,
        learnersUpdated: 0,
        participationsCreated: 0,
        questionsCreated: 0,
        responsesCreated: 0,
        evaluationResponsesCreated: 0,
        emailAliasesFlagged: 0,
        errors: [err instanceof Error ? err.message : "Import failed"],
        warnings: [],
      });
      setStep("results");
    }
    setImporting(false);
  };

  const resetWizard = () => {
    setStep("source");
    setSelectedSource("auto");
    setDetectedSource(null);
    setFiles([]);
    setParsed(null);
    setHasHighlighting(false);
    setActivity({
      activity_id: "",
      activity_name: "",
      activity_type: "",
      activity_date: "",
      therapeutic_area: "",
      disease_state: "",
      sponsor: "",
    });
    setResult(null);
  };

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold mb-6">Data Import</h1>

      {/* Step indicators */}
      <div className="flex gap-1.5 mb-8 overflow-x-auto">
        {STEPS.map((s, i) => (
          <div
            key={s}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap ${
              step === s
                ? "bg-teal-500 text-white"
                : STEPS.indexOf(step) > i
                ? "bg-teal-100 text-teal-700"
                : "bg-navy-50 text-navy-300"
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[10px]">
              {i + 1}
            </span>
            {STEP_LABELS[s]}
          </div>
        ))}
      </div>

      {/* Step 1: Source Selection */}
      {step === "source" && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <SourceSelector selected={selectedSource} onChange={setSelectedSource} />
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setStep("upload")}
              className="px-4 py-2 bg-teal-500 text-white rounded-lg text-sm hover:bg-teal-600"
            >
              Next: Upload Files
            </button>
          </div>
        </div>
      )}

      {/* Step 2: File Upload */}
      {step === "upload" && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <MultiFileUploader
              files={files}
              onFilesChange={handleFilesChange}
              maxFiles={maxFiles}
              label={needsTwoFiles ? "Upload Pretest & Posttest Files" : effectiveSource === "globalmeet" ? "Upload Webinar Report(s)" : "Upload Data File"}
              hint={needsTwoFiles ? "Upload both pretest and posttest .xlsx files" : effectiveSource === "globalmeet" ? "Upload 1 or 2 broadcast reports (.xlsx)" : "Supports .xlsx, .xls, .csv"}
            />

            {/* Auto-detect result */}
            {selectedSource === "auto" && detectedSource && (
              <div className="mt-4 p-3 bg-teal-50 border border-teal-200 rounded-lg text-sm">
                <span className="font-medium text-teal-700">Detected: </span>
                <span className="text-teal-600">{formatSource(detectedSource)}</span>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep("source")}
              className="px-4 py-2 border rounded-lg text-sm hover:bg-navy-50"
            >
              Back
            </button>
            <button
              onClick={handleParse}
              disabled={files.length === 0 || !effectiveSource || (needsTwoFiles && files.length < 2)}
              className="px-4 py-2 bg-teal-500 text-white rounded-lg text-sm hover:bg-teal-600 disabled:opacity-50"
            >
              Parse Files
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Answer Key (conditional) */}
      {step === "answer-key" && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <AnswerKeyUploader
              onAnswerKeyLoaded={handleAnswerKeyLoaded}
              hasHighlighting={hasHighlighting}
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setStep("upload")}
              className="px-4 py-2 border rounded-lg text-sm hover:bg-navy-50"
            >
              Back
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Parse Preview */}
      {step === "preview" && parsed && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <ParsePreview parsed={parsed} />
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setStep("answer-key")}
              className="px-4 py-2 border rounded-lg text-sm hover:bg-navy-50"
            >
              Back
            </button>
            <button
              onClick={() => setStep("activity")}
              className="px-4 py-2 bg-teal-500 text-white rounded-lg text-sm hover:bg-teal-600"
            >
              Next: Activity Info
            </button>
          </div>
        </div>
      )}

      {/* Step 5: Activity Metadata */}
      {step === "activity" && parsed && (
        <div className="space-y-6">
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
                  <option value="On-Demand">On-Demand</option>
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
              onClick={() => setStep("preview")}
              className="px-4 py-2 border rounded-lg text-sm hover:bg-navy-50"
            >
              Back
            </button>
            <button
              onClick={handleImport}
              disabled={!activity.activity_id || !activity.activity_name || importing}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700 disabled:opacity-50"
            >
              {importing ? "Importing..." : "Import Data"}
            </button>
          </div>
        </div>
      )}

      {/* Step 6: Results */}
      {step === "results" && result && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold mb-4">Import Results</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="text-center p-3 bg-teal-50 rounded-lg">
              <div className="text-2xl font-bold text-teal-700">{result.learnersCreated}</div>
              <div className="text-xs text-teal-600">Learners Created</div>
            </div>
            <div className="text-center p-3 bg-teal-50 rounded-lg">
              <div className="text-2xl font-bold text-teal-700">{result.learnersUpdated}</div>
              <div className="text-xs text-teal-600">Learners Updated</div>
            </div>
            <div className="text-center p-3 bg-accent-50 rounded-lg">
              <div className="text-2xl font-bold text-accent-700">{result.participationsCreated}</div>
              <div className="text-xs text-accent-600">Participations</div>
            </div>
            <div className="text-center p-3 bg-navy-50 rounded-lg">
              <div className="text-2xl font-bold text-navy-700">{result.questionsCreated}</div>
              <div className="text-xs text-navy-500">Questions</div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-xl font-bold text-navy-700">{result.responsesCreated}</div>
              <div className="text-xs text-navy-500">Question Responses</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-xl font-bold text-navy-700">{result.evaluationResponsesCreated}</div>
              <div className="text-xs text-navy-500">Evaluation Responses</div>
            </div>
            {result.emailAliasesFlagged > 0 && (
              <div className="text-center p-3 bg-amber-50 rounded-lg">
                <div className="text-xl font-bold text-amber-700">{result.emailAliasesFlagged}</div>
                <div className="text-xs text-amber-600">Email Aliases Flagged</div>
              </div>
            )}
          </div>

          {result.warnings.length > 0 && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="font-medium text-amber-700 mb-2">Warnings ({result.warnings.length}):</p>
              <ul className="text-sm text-amber-600 space-y-1">
                {result.warnings.slice(0, 10).map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
                {result.warnings.length > 10 && (
                  <li>...and {result.warnings.length - 10} more</li>
                )}
              </ul>
            </div>
          )}

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
            onClick={resetWizard}
            className="mt-4 px-4 py-2 bg-teal-500 text-white rounded-lg text-sm hover:bg-teal-600"
          >
            Import Another File
          </button>
        </div>
      )}
    </div>
  );
}

function formatSource(source: string): string {
  const labels: Record<string, string> = {
    array: "Array Report",
    globalmeet: "GlobalMeet",
    pigeonhole: "Pigeonhole",
    snowflake_eval: "Live Evaluation Data (Snowflake)",
    snowflake_ondemand: "On-Demand Data (Snowflake)",
  };
  return labels[source] || source;
}
