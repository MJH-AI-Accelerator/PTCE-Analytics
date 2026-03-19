"use client";

import { useCallback, useRef } from "react";
import { Upload } from "lucide-react";

interface FileUploaderProps {
  onFileLoaded: (buffer: ArrayBuffer, fileName: string) => void;
}

export default function FileUploader({ onFileLoaded }: FileUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          onFileLoaded(e.target.result as ArrayBuffer, file.name);
        }
      };
      reader.readAsArrayBuffer(file);
    },
    [onFileLoaded]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      onClick={() => inputRef.current?.click()}
      className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center cursor-pointer hover:border-teal-400 transition-colors"
    >
      <Upload className="mx-auto mb-4 text-navy-300" size={40} />
      <p className="text-navy-500 font-medium">
        Drag &amp; drop a file here, or click to browse
      </p>
      <p className="text-navy-300 text-sm mt-2">Supports .xlsx, .xls, .csv</p>
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
  );
}
