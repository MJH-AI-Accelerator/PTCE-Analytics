"use client";

import type { ParsedActivityData, MergeResult } from "@/lib/parsers/types";
import { formatSourceLabel } from "@/lib/parsers/merge-sources";
import { Users, HelpCircle, AlertTriangle, XCircle, FileText, Link2 } from "lucide-react";

interface ParsePreviewProps {
  parsed: ParsedActivityData;
  mergeResult?: MergeResult;
}

export default function ParsePreview({ parsed, mergeResult }: ParsePreviewProps) {
  const assessmentQuestions = parsed.questions.filter((q) => q.questionType === "assessment");
  const confidenceQuestions = parsed.questions.filter((q) => q.questionType === "confidence");
  const evaluationQuestions = parsed.questions.filter((q) => q.questionType === "evaluation");
  const arsQuestions = parsed.questions.filter((q) => q.questionType === "ars");
  const pulseQuestions = parsed.questions.filter((q) => q.questionType === "pulse");

  const scoredQuestions = assessmentQuestions.filter((q) => q.correctAnswer);
  const exclusionWarnings = parsed.warnings.filter((w) => w.type === "exclusion");
  const dataWarnings = parsed.warnings.filter((w) => w.type !== "exclusion");

  const isMerged = mergeResult && mergeResult.sourceBreakdown.length > 1;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Parse Preview</h2>

      {/* Summary metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-teal-50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-teal-700">{parsed.learners.length}</div>
          <div className="text-xs text-teal-600 flex items-center justify-center gap-1 mt-1">
            <Users size={12} /> Learners
          </div>
        </div>
        <div className="bg-accent-50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-accent-700">{parsed.questions.length}</div>
          <div className="text-xs text-accent-600 flex items-center justify-center gap-1 mt-1">
            <HelpCircle size={12} /> Questions
          </div>
        </div>
        <div className="bg-navy-50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-navy-700">
            {parsed.learners.reduce((sum, l) => sum + l.responses.length + l.evaluationResponses.length, 0)}
          </div>
          <div className="text-xs text-navy-500 mt-1">Total Responses</div>
        </div>
        {parsed.excludedCount > 0 && (
          <div className="bg-amber-50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-amber-700">{parsed.excludedCount}</div>
            <div className="text-xs text-amber-600 flex items-center justify-center gap-1 mt-1">
              <XCircle size={12} /> Excluded
            </div>
          </div>
        )}
      </div>

      {/* Merge breakdown (when multiple sources) */}
      {isMerged && mergeResult && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Link2 size={16} className="text-purple-600" />
            <h3 className="text-sm font-semibold text-purple-700">Cross-Platform Merge</h3>
          </div>

          <div className="space-y-2 mb-3">
            {mergeResult.sourceBreakdown.map((sb, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <FileText size={12} className="text-navy-400" />
                  <span className="text-navy-600">{formatSourceLabel(sb.source)}</span>
                  <span className="text-navy-400 text-xs truncate max-w-[200px]">({sb.fileName})</span>
                </div>
                <span className="text-navy-500 text-xs">
                  {sb.learnerCount} learners, {sb.questionCount} questions
                </span>
              </div>
            ))}
          </div>

          <div className="flex gap-4 text-xs">
            {mergeResult.matchedCount > 0 && (
              <span className="text-teal-600 font-medium">
                {mergeResult.matchedCount} email matches
              </span>
            )}
            {mergeResult.assessmentOnlyCount > 0 && (
              <span className="text-navy-500">
                {mergeResult.assessmentOnlyCount} assessment-only
              </span>
            )}
            {mergeResult.evalOnlyCount > 0 && (
              <span className="text-amber-600">
                {mergeResult.evalOnlyCount} eval-only
              </span>
            )}
          </div>
        </div>
      )}

      {/* Source info (single source) */}
      {!isMerged && (
        <div className="bg-white rounded-lg border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-3">
            <FileText size={16} className="text-navy-400" />
            <span className="text-sm font-medium text-navy-700">Source: {formatSourceLabel(parsed.source)}</span>
          </div>
          <div className="text-sm text-navy-500">{parsed.sourceFileName}</div>
          {parsed.suggestedActivityName && (
            <div className="text-sm text-navy-400 mt-1">
              Suggested name: <span className="font-medium">{parsed.suggestedActivityName}</span>
            </div>
          )}
        </div>
      )}

      {/* Suggested name (for merged) */}
      {isMerged && parsed.suggestedActivityName && (
        <div className="text-sm text-navy-400">
          Suggested name: <span className="font-medium text-navy-600">{parsed.suggestedActivityName}</span>
        </div>
      )}

      {/* Question breakdown */}
      <div className="bg-white rounded-lg border border-gray-100 p-4">
        <h3 className="text-sm font-semibold text-navy-700 mb-3">Questions Found</h3>
        <div className="space-y-2 text-sm">
          {assessmentQuestions.length > 0 && (
            <div className="flex justify-between">
              <span className="text-navy-500">Assessment</span>
              <span className="font-medium">
                {assessmentQuestions.length}
                {scoredQuestions.length > 0 && (
                  <span className="text-teal-600 ml-1">({scoredQuestions.length} with answer key)</span>
                )}
              </span>
            </div>
          )}
          {confidenceQuestions.length > 0 && (
            <div className="flex justify-between">
              <span className="text-navy-500">Confidence</span>
              <span className="font-medium">{confidenceQuestions.length}</span>
            </div>
          )}
          {evaluationQuestions.length > 0 && (
            <div className="flex justify-between">
              <span className="text-navy-500">Evaluation</span>
              <span className="font-medium">{evaluationQuestions.length}</span>
            </div>
          )}
          {arsQuestions.length > 0 && (
            <div className="flex justify-between">
              <span className="text-navy-500">ARS</span>
              <span className="font-medium">{arsQuestions.length}</span>
            </div>
          )}
          {pulseQuestions.length > 0 && (
            <div className="flex justify-between">
              <span className="text-navy-500">Pulse</span>
              <span className="font-medium">{pulseQuestions.length}</span>
            </div>
          )}
        </div>
      </div>

      {/* Warnings */}
      {dataWarnings.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={16} className="text-amber-600" />
            <h3 className="text-sm font-semibold text-amber-700">Warnings ({dataWarnings.length})</h3>
          </div>
          <ul className="text-sm text-amber-600 space-y-1">
            {dataWarnings.slice(0, 10).map((w, i) => (
              <li key={i}>{w.message}{w.context ? ` — ${w.context}` : ""}</li>
            ))}
            {dataWarnings.length > 10 && (
              <li>...and {dataWarnings.length - 10} more</li>
            )}
          </ul>
        </div>
      )}

      {/* Exclusions */}
      {exclusionWarnings.length > 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-navy-600 mb-2">
            Excluded ({exclusionWarnings.length} learners)
          </h3>
          <ul className="text-xs text-navy-400 space-y-0.5 max-h-32 overflow-y-auto">
            {exclusionWarnings.slice(0, 20).map((w, i) => (
              <li key={i}>{w.context}: {w.message}</li>
            ))}
            {exclusionWarnings.length > 20 && (
              <li>...and {exclusionWarnings.length - 20} more</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
