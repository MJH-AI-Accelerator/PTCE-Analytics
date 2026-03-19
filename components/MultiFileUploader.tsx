"use client";

import { useCallback, useRef } from "react";
import { Upload, X, FileText } from "lucide-react";

interface FileEntry {
  buffer: ArrayBuffer;
  name: string;
}

interface MultiFileUploaderProps {
  files: FileEntry[];
  onFilesChange: (files: FileEntry[]) => void;
  maxFiles?: number;
  label?: string;
  hint?: string;
}

export default function MultiFileUploader({
  files,
  onFilesChange,
  maxFiles = 1,
  label = "Upload File",
  hint = "Supports .xlsx, .xls, .csv",
}: MultiFileUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          const entry: FileEntry = { buffer: e.target.result as ArrayBuffer, name: file.name };
          if (maxFiles === 1) {
            onFilesChange([entry]);
          } else {
            onFilesChange([...files.slice(0, maxFiles - 1), entry]);
          }
        }
      };
      reader.readAsArrayBuffer(file);
    },
    [files, maxFiles, onFilesChange]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const droppedFiles = Array.from(e.dataTransfer.files);
      for (const file of droppedFiles.slice(0, maxFiles - files.length)) {
        handleFile(file);
      }
    },
    [handleFile, maxFiles, files.length]
  );

  const removeFile = (index: number) => {
    onFilesChange(files.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-navy-600">{label}</label>

      {/* Uploaded files */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((f, i) => (
            <div key={i} className="flex items-center gap-3 p-3 bg-teal-50 border border-teal-200 rounded-lg">
              <FileText size={18} className="text-teal-600 shrink-0" />
              <span className="text-sm text-navy-700 flex-1 truncate">{f.name}</span>
              <button
                onClick={() => removeFile(i)}
                className="text-navy-400 hover:text-red-500 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Drop zone */}
      {files.length < maxFiles && (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-teal-400 transition-colors"
        >
          <Upload className="mx-auto mb-3 text-navy-300" size={32} />
          <p className="text-navy-500 font-medium text-sm">
            {files.length === 0 ? "Drag & drop a file here, or click to browse" : "Add another file"}
          </p>
          <p className="text-navy-300 text-xs mt-1">{hint}</p>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
        </div>
      )}
    </div>
  );
}

export type { FileEntry };
