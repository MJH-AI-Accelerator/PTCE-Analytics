"use client";

import { useRef, useState } from "react";
import { Upload, FileText, Check, AlertCircle } from "lucide-react";
import type { AnswerKeyEntry } from "@/lib/parsers/types";

interface AnswerKeyUploaderProps {
  onAnswerKeyLoaded: (entries: AnswerKeyEntry[]) => void;
  hasHighlighting: boolean;
}

export default function AnswerKeyUploader({ onAnswerKeyLoaded, hasHighlighting }: AnswerKeyUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [entryCount, setEntryCount] = useState(0);

  if (hasHighlighting) {
    return (
      <div className="p-4 bg-teal-50 border border-teal-200 rounded-lg flex items-center gap-3">
        <Check size={20} className="text-teal-600 shrink-0" />
        <div>
          <p className="text-sm font-medium text-teal-700">Answer key detected from cell highlighting</p>
          <p className="text-xs text-teal-600 mt-0.5">Correct answers were identified via #B5E09B background color</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2">
        <AlertCircle size={18} className="text-amber-500 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium text-navy-700">Answer key required</p>
          <p className="text-xs text-navy-400 mt-0.5">
            This file format does not highlight correct answers. Upload the survey assessment document (.docx) to score responses.
          </p>
        </div>
      </div>

      {fileName ? (
        <div className="flex items-center gap-3 p-3 bg-teal-50 border border-teal-200 rounded-lg">
          <FileText size={18} className="text-teal-600 shrink-0" />
          <div className="flex-1">
            <span className="text-sm text-navy-700">{fileName}</span>
            <span className="text-xs text-teal-600 ml-2">({entryCount} answers found)</span>
          </div>
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-amber-300 rounded-lg p-6 text-center cursor-pointer hover:border-amber-400 transition-colors bg-amber-50/50"
        >
          <Upload className="mx-auto mb-2 text-amber-400" size={28} />
          <p className="text-navy-500 font-medium text-sm">Upload survey assessment document</p>
          <p className="text-navy-300 text-xs mt-1">Optional — you can import without scoring</p>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".docx,.doc"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            setFileName(file.name);
            // For now, just notify that a doc was uploaded
            // Full .docx parsing would require mammoth.js or similar
            setEntryCount(0);
            onAnswerKeyLoaded([]);
          }
        }}
      />

      <button
        onClick={() => onAnswerKeyLoaded([])}
        className="text-sm text-navy-400 hover:text-navy-600 underline"
      >
        Skip — import without scoring
      </button>
    </div>
  );
}
