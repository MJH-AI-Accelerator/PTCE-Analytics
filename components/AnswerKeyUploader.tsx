"use client";

import { useRef, useState } from "react";
import { Upload, FileText, Check, AlertCircle, BookOpen } from "lucide-react";
import { parseSurveyAssessmentDoc } from "@/lib/parsers/survey-doc-parser";
import type { AnswerKeyEntry } from "@/lib/parsers/types";

interface AnswerKeyUploaderProps {
  onAnswerKeyLoaded: (entries: AnswerKeyEntry[]) => void;
  hasHighlighting: boolean;
}

export default function AnswerKeyUploader({ onAnswerKeyLoaded, hasHighlighting }: AnswerKeyUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [entryCount, setEntryCount] = useState(0);
  const [categoryCount, setCategoryCount] = useState(0);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = async (file: File) => {
    setParsing(true);
    setError(null);
    setFileName(file.name);

    try {
      const buffer = await file.arrayBuffer();
      const { entries, raw } = await parseSurveyAssessmentDoc(buffer);

      setEntryCount(entries.length);
      setCategoryCount(raw.filter((q) => q.category != null).length);
      onAnswerKeyLoaded(entries);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse document");
      setEntryCount(0);
      setCategoryCount(0);
    }
    setParsing(false);
  };

  return (
    <div className="space-y-4">
      {/* Answer key status */}
      {hasHighlighting && (
        <div className="p-4 bg-teal-50 border border-teal-200 rounded-lg flex items-center gap-3">
          <Check size={20} className="text-teal-600 shrink-0" />
          <div>
            <p className="text-sm font-medium text-teal-700">Answer key detected from cell highlighting</p>
            <p className="text-xs text-teal-600 mt-0.5">Correct answers were identified via #B5E09B background color</p>
          </div>
        </div>
      )}

      {!hasHighlighting && !fileName && (
        <div className="flex items-start gap-2">
          <AlertCircle size={18} className="text-amber-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-navy-700">Answer key required</p>
            <p className="text-xs text-navy-400 mt-0.5">
              This file format does not highlight correct answers. Upload the survey assessment document to score responses.
            </p>
          </div>
        </div>
      )}

      {/* Survey assessment document upload */}
      <div className="border border-gray-200 rounded-lg p-4 space-y-3">
        <div className="flex items-start gap-2">
          <BookOpen size={18} className="text-navy-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-navy-700">Survey Assessment Document</p>
            <p className="text-xs text-navy-400 mt-0.5">
              Upload the companion .docx to extract learning objective mappings and question categories
              {!hasHighlighting && " and answer keys"}.
            </p>
          </div>
        </div>

        {fileName ? (
          <div className="flex items-center gap-3 p-3 bg-teal-50 border border-teal-200 rounded-lg">
            <FileText size={18} className="text-teal-600 shrink-0" />
            <div className="flex-1">
              <span className="text-sm text-navy-700">{fileName}</span>
              <div className="flex gap-3 mt-0.5">
                {entryCount > 0 && (
                  <span className="text-xs text-teal-600">{entryCount} questions found</span>
                )}
                {categoryCount > 0 && (
                  <span className="text-xs text-teal-600">{categoryCount} categories mapped</span>
                )}
                {entryCount === 0 && !parsing && (
                  <span className="text-xs text-amber-600">No questions extracted — check document format</span>
                )}
              </div>
            </div>
            <button
              onClick={() => {
                setFileName(null);
                setEntryCount(0);
                setCategoryCount(0);
                setError(null);
              }}
              className="text-xs text-navy-400 hover:text-navy-600 underline"
            >
              Replace
            </button>
          </div>
        ) : (
          <div
            onClick={() => inputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
              parsing ? "border-gray-300 bg-gray-50" : "border-navy-200 hover:border-navy-300 bg-navy-50/30"
            }`}
          >
            {parsing ? (
              <p className="text-navy-500 text-sm">Parsing document...</p>
            ) : (
              <>
                <Upload className="mx-auto mb-2 text-navy-400" size={28} />
                <p className="text-navy-500 font-medium text-sm">Upload survey assessment document (.docx)</p>
                <p className="text-navy-300 text-xs mt-1">Extracts learning objectives, categories, and answer keys</p>
              </>
            )}
          </div>
        )}

        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".docx,.doc"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileUpload(file);
        }}
      />

      {/* Skip option */}
      {!fileName && (
        <button
          onClick={() => onAnswerKeyLoaded([])}
          className="text-sm text-navy-400 hover:text-navy-600 underline"
        >
          Skip — {hasHighlighting ? "continue without categories" : "import without scoring"}
        </button>
      )}
    </div>
  );
}
