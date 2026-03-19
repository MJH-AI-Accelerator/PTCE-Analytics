"use client";

import { useState, useCallback } from "react";
import SourceSelector from "@/components/SourceSelector";
import MultiFileUploader from "@/components/MultiFileUploader";
import AnswerKeyUploader from "@/components/AnswerKeyUploader";
import ParsePreview from "@/components/ParsePreview";
import { parseArrayFile } from "@/lib/parsers/array-parser";
import { parseGlobalMeetFile, mergeGlobalMeetFiles } from "@/lib/parsers/globalmeet-parser";
import { parsePigeonholeFiles } from "@/lib/parsers/pigeonhole-parser";
import { parseSnowflakeEvalFile } from "@/lib/parsers/snowflake-eval-parser";
import { parseSnowflakeOnDemandFile } from "@/lib/parsers/snowflake-ondemand-parser";
import { mergeSources } from "@/lib/parsers/merge-sources";
import { importParsedData } from "./actions";
import type { DataSource, DetectedFile, ParsedActivityData, AnswerKeyEntry, MergeResult } from "@/lib/parsers/types";
import type { ActivityMetadata } from "@/lib/ingestion/pipeline";

type Step = "source" | "upload" | "answer-key" | "preview" | "activity" | "results";

const STEPS: Step[] = ["source", "upload", "answer-key", "preview", "activity", "results"];
const STEP_LABELS: Record<Step, string> = {
  source: "Source",
  upload: "Upload",
  "answer-key": "Answer Key",
  preview: "Preview",
  activity: "Activity Info",
  results: "Results",
};

export default function DataImport() {
  const [step, setStep] = useState<Step>("source");
  const [selectedSources, setSelectedSources] = useState<Set<DataSource | "auto">>(new Set(["auto"]));
  const [files, setFiles] = useState<DetectedFile[]>([]);
  const [parsed, setParsed] = useState<ParsedActivityData | null>(null);
  const [mergeResult, setMergeResult] = useState<MergeResult | null>(null);
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

  const handleParse = useCallback(() => {
    if (files.length === 0) return;

    try {
      const parsedFiles: ParsedActivityData[] = [];

      // Group files by detected source
      const pigeonholeFiles = files.filter((f) => f.detection?.source === "pigeonhole");
      const globalmeetFiles = files.filter((f) => f.detection?.source === "globalmeet");
      const otherFiles = files.filter(
        (f) => f.detection?.source !== "pigeonhole" && f.detection?.source !== "globalmeet"
      );

      // Parse Pigeonhole files (need pre + post pairing)
      if (pigeonholeFiles.length >= 2) {
        const result = parsePigeonholeFiles(
          pigeonholeFiles[0].buffer,
          pigeonholeFiles[1].buffer,
          pigeonholeFiles[0].fileName,
          pigeonholeFiles[1].fileName
        );
        parsedFiles.push(result);
      } else if (pigeonholeFiles.length === 1) {
        const result = parsePigeonholeFiles(
          pigeonholeFiles[0].buffer,
          pigeonholeFiles[0].buffer,
          pigeonholeFiles[0].fileName,
          pigeonholeFiles[0].fileName
        );
        parsedFiles.push(result);
      }

      // Parse GlobalMeet files (may need multi-broadcast merge)
      if (globalmeetFiles.length > 0) {
        const gmParsed = globalmeetFiles.map((f) =>
          parseGlobalMeetFile(f.buffer, f.fileName)
        );
        if (gmParsed.length > 1) {
          parsedFiles.push(mergeGlobalMeetFiles(gmParsed));
        } else {
          parsedFiles.push(gmParsed[0]);
        }
      }

      // Parse all other files individually
      for (const file of otherFiles) {
        if (!file.detection) continue;
        switch (file.detection.source) {
          case "array":
            parsedFiles.push(parseArrayFile(file.buffer, file.fileName));
            break;
          case "snowflake_eval":
            parsedFiles.push(parseSnowflakeEvalFile(file.buffer, file.fileName));
            break;
          case "snowflake_ondemand":
            parsedFiles.push(parseSnowflakeOnDemandFile(file.buffer, file.fileName));
            break;
        }
      }

      if (parsedFiles.length === 0) {
        alert("No files could be parsed. Check that files are in a supported format.");
        return;
      }

      // Merge all parsed data
      const merge = mergeSources(parsedFiles);
      setMergeResult(merge);
      setParsed(merge.merged);

      // Check for answer key highlighting
      const hasHL = merge.merged.questions.some((q) => q.correctAnswer != null);
      setHasHighlighting(hasHL);

      // Pre-populate activity metadata
      if (merge.merged.suggestedActivityName) {
        setActivity((prev) => ({
          ...prev,
          activity_name: prev.activity_name || merge.merged.suggestedActivityName || "",
        }));
      }

      setStep("answer-key");
    } catch (err) {
      alert(`Parse error: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }, [files]);

  const handleAnswerKeyLoaded = useCallback((_entries: AnswerKeyEntry[]) => {
    setStep("preview");
  }, []);

  const handleImport = async () => {
    if (!parsed || !activity.activity_id || !activity.activity_name) return;
    setImporting(true);
    try {
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
    setSelectedSources(new Set(["auto"]));
    setFiles([]);
    setParsed(null);
    setMergeResult(null);
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

  const detectedCount = files.filter((f) => f.detection != null).length;

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
            <SourceSelector selected={selectedSources} onChange={setSelectedSources} />
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

      {/* Step 2: Upload */}
      {step === "upload" && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <MultiFileUploader files={files} onFilesChange={setFiles} />
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
              disabled={files.length === 0 || detectedCount === 0}
              className="px-4 py-2 bg-teal-500 text-white rounded-lg text-sm hover:bg-teal-600 disabled:opacity-50"
            >
              Parse {files.length} File{files.length !== 1 ? "s" : ""}
            </button>
            {files.length > 0 && detectedCount < files.length && (
              <span className="text-sm text-amber-600 flex items-center">
                {files.length - detectedCount} file{files.length - detectedCount !== 1 ? "s" : ""} could not be detected
              </span>
            )}
          </div>
        </div>
      )}

      {/* Step 3: Answer Key */}
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
            {hasHighlighting && (
              <button
                onClick={() => setStep("preview")}
                className="px-4 py-2 bg-teal-500 text-white rounded-lg text-sm hover:bg-teal-600"
              >
                Next: Preview
              </button>
            )}
          </div>
        </div>
      )}

      {/* Step 4: Parse Preview */}
      {step === "preview" && parsed && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <ParsePreview parsed={parsed} mergeResult={mergeResult ?? undefined} />
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
