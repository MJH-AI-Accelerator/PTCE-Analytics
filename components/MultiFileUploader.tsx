"use client";

import { useCallback, useRef } from "react";
import { Upload, X, FileText, CheckCircle, AlertCircle } from "lucide-react";
import type { DetectedFile } from "@/lib/parsers/types";
import { detectSource } from "@/lib/parsers/detect-source";
import { classifyFileRole, formatSourceLabel } from "@/lib/parsers/merge-sources";

interface MultiFileUploaderProps {
  files: DetectedFile[];
  onFilesChange: (files: DetectedFile[]) => void;
}

export default function MultiFileUploader({ files, onFilesChange }: MultiFileUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const addFile = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          const buffer = e.target.result as ArrayBuffer;
          const detection = detectSource(buffer);
          const role = detection ? classifyFileRole(detection.source) : "assessment";

          const entry: DetectedFile = {
            id: crypto.randomUUID(),
            fileName: file.name,
            buffer,
            detection,
            role,
            status: "pending",
          };
          onFilesChange([...files, entry]);
        }
      };
      reader.readAsArrayBuffer(file);
    },
    [files, onFilesChange]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      for (const file of Array.from(e.dataTransfer.files)) {
        addFile(file);
      }
    },
    [addFile]
  );

  const removeFile = (id: string) => {
    onFilesChange(files.filter((f) => f.id !== id));
  };

  const roleLabel = (role: string) => {
    switch (role) {
      case "assessment": return "Assessment";
      case "evaluation": return "Evaluation";
      case "standalone": return "Standalone";
      default: return role;
    }
  };

  const roleBadgeColor = (role: string) => {
    switch (role) {
      case "assessment": return "bg-teal-100 text-teal-700";
      case "evaluation": return "bg-purple-100 text-purple-700";
      case "standalone": return "bg-navy-100 text-navy-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-navy-600">
          Upload all files for this program
        </label>
        <span className="text-xs text-navy-400">{files.length} file{files.length !== 1 ? "s" : ""} added</span>
      </div>

      {/* Uploaded files with detection results */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((f) => (
            <div
              key={f.id}
              className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg"
            >
              <FileText size={18} className="text-navy-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-navy-700 truncate">{f.fileName}</div>
                <div className="flex items-center gap-2 mt-1">
                  {f.detection ? (
                    <>
                      <CheckCircle size={12} className="text-teal-500" />
                      <span className="text-xs text-navy-500">
                        {formatSourceLabel(f.detection.source)}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${roleBadgeColor(f.role)}`}>
                        {roleLabel(f.role)}
                      </span>
                      {f.detection.confidence !== "high" && (
                        <span className="text-[10px] text-amber-600">({f.detection.confidence} confidence)</span>
                      )}
                    </>
                  ) : (
                    <>
                      <AlertCircle size={12} className="text-amber-500" />
                      <span className="text-xs text-amber-600">Could not detect source type</span>
                    </>
                  )}
                </div>
              </div>
              <button
                onClick={() => removeFile(f.id)}
                className="text-navy-300 hover:text-red-500 transition-colors shrink-0"
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-teal-400 transition-colors"
      >
        <Upload className="mx-auto mb-3 text-navy-300" size={32} />
        <p className="text-navy-500 font-medium text-sm">
          {files.length === 0
            ? "Drag & drop files here, or click to browse"
            : "Add more files"}
        </p>
        <p className="text-navy-300 text-xs mt-1">
          Drop all files for this program — Array, GlobalMeet, Pigeonhole, Snowflake
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) {
              for (const file of Array.from(e.target.files)) {
                addFile(file);
              }
            }
            // Reset so the same file can be re-selected
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}

export type { DetectedFile };
