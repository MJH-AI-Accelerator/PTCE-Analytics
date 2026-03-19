"use client";

import type { ImportSummary } from "@/lib/analytics/import-summary";

interface ImportResultsProps {
  summary: ImportSummary;
  errors: string[];
  warnings: string[];
  onReset: () => void;
}

function formatPct(val: number | null, decimals = 0): string {
  if (val == null) return "—";
  return `${val.toFixed(decimals)}%`;
}

function changeColor(val: number | null): string {
  if (val == null) return "text-navy-500";
  if (val > 0) return "text-green-600";
  if (val < 0) return "text-red-600";
  return "text-navy-500";
}

function changePrefix(val: number | null): string {
  if (val == null) return "";
  if (val > 0) return "+";
  return "";
}

export default function ImportResults({ summary, errors, warnings, onReset }: ImportResultsProps) {
  const hasErrors = errors.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold mb-4">Import Summary</h2>

        {/* Primary Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-2">
          <MetricCard
            value={summary.learnerCount}
            label="Learner Count"
            sublabel="From assessment data"
            bg="bg-teal-50"
            text="text-teal-700"
            subtext="text-teal-600"
          />
          <MetricCard
            value={summary.completerCount}
            label="Completer Count"
            sublabel="From evaluation data"
            bg="bg-teal-50"
            text="text-teal-700"
            subtext="text-teal-600"
          />
          <MetricCard
            value={summary.matchedCount}
            label="Matched Emails"
            sublabel="Across both sources"
            bg="bg-accent-50"
            text="text-accent-700"
            subtext="text-accent-600"
          />
          <MetricCard
            value={summary.questionsCreated}
            label="Questions Created"
            sublabel="Assessment questions"
            bg="bg-navy-50"
            text="text-navy-700"
            subtext="text-navy-500"
          />
        </div>
      </div>

      {/* Overall Score Summary — 2 decimal places */}
      {summary.avgPreScore != null && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-sm font-semibold text-navy-600 mb-3">Overall Assessment Performance</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-navy-700">{formatPct(summary.avgPreScore, 2)}</div>
              <div className="text-xs text-navy-500">Avg Pre-Test</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-navy-700">{formatPct(summary.avgPostScore, 2)}</div>
              <div className="text-xs text-navy-500">Avg Post-Test</div>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-bold ${changeColor(summary.avgScoreChange)}`}>
                {changePrefix(summary.avgScoreChange)}{formatPct(summary.avgScoreChange, 2)}
              </div>
              <div className="text-xs text-navy-500">Change</div>
            </div>
          </div>
        </div>
      )}

      {/* Per-Question Performance — whole numbers */}
      {summary.questionPerformance.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-sm font-semibold text-navy-600 mb-3">Question-Level Pre vs. Post Performance</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-2 text-navy-500 font-medium">Q#</th>
                  <th className="text-left py-2 px-2 text-navy-500 font-medium">Question</th>
                  <th className="text-left py-2 px-2 text-navy-500 font-medium">Correct Answer</th>
                  <th className="text-left py-2 px-2 text-navy-500 font-medium">Category</th>
                  <th className="text-right py-2 px-2 text-navy-500 font-medium">Pre</th>
                  <th className="text-right py-2 px-2 text-navy-500 font-medium">Post</th>
                  <th className="text-right py-2 px-2 text-navy-500 font-medium">Change</th>
                </tr>
              </thead>
              <tbody>
                {summary.questionPerformance.map((q) => (
                  <tr key={q.questionNumber} className="border-b border-gray-100">
                    <td className="py-2 px-2 font-medium text-navy-600">Q{q.questionNumber}</td>
                    <td className="py-2 px-2 text-navy-600 text-xs leading-snug">
                      {q.questionText}
                    </td>
                    <td className="py-2 px-2 text-navy-500 text-xs leading-snug">
                      {q.correctAnswer ?? "—"}
                    </td>
                    <td className="py-2 px-2 text-navy-500 text-xs">{q.questionCategory ?? "—"}</td>
                    <td className="py-2 px-2 text-right text-navy-600">{formatPct(q.preCorrectPct)}</td>
                    <td className="py-2 px-2 text-right text-navy-600">{formatPct(q.postCorrectPct)}</td>
                    <td className={`py-2 px-2 text-right font-medium ${changeColor(q.changePct)}`}>
                      {q.changePct != null ? `${changePrefix(q.changePct)}${q.changePct}%` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Confidence Summary — % selecting Moderately/Very/Extremely */}
      {summary.confidence.preRespondents > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-sm font-semibold text-navy-600 mb-3">Confidence</h3>
          <p className="text-xs text-navy-400 mb-3">
            % of learners selecting Moderately, Very, or Extremely Confident
          </p>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-navy-700">{formatPct(summary.confidence.preHighPct)}</div>
              <div className="text-xs text-navy-500">Pre-Activity</div>
              <div className="text-[10px] text-navy-400">{summary.confidence.preRespondents} respondents</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-navy-700">{formatPct(summary.confidence.postHighPct)}</div>
              <div className="text-xs text-navy-500">Post-Activity</div>
              <div className="text-[10px] text-navy-400">{summary.confidence.postRespondents} respondents</div>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-bold ${changeColor(summary.confidence.changePct)}`}>
                {changePrefix(summary.confidence.changePct)}{formatPct(summary.confidence.changePct)}
              </div>
              <div className="text-xs text-navy-500">Change</div>
            </div>
          </div>
          {summary.confidence.improvedPct != null && (
            <div className="p-2 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
              <span className="font-medium">{formatPct(summary.confidence.improvedPct)}</span> of learners who rated their confidence as Not at all / Somewhat on the pre-test shifted to Moderately / Very / Extremely on the post-test ({summary.confidence.improvedCount} learners)
            </div>
          )}
        </div>
      )}

      {/* Category Performance & Weakest Category */}
      {summary.categoryPerformance.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-sm font-semibold text-navy-600 mb-3">Performance by Learning Objective / Category</h3>
          {summary.weakestCategory && (
            <div className="mb-3 p-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
              <span className="font-medium">Needs attention:</span> {summary.weakestCategory} (lowest post-test performance)
            </div>
          )}
          <div className="space-y-4">
            {summary.categoryPerformance.map((c) => (
              <div key={c.category}>
                <div className="flex items-center justify-between mb-1">
                  <div className="text-sm text-navy-600 font-medium truncate" title={c.category}>
                    {c.category}
                    <span className="text-navy-400 font-normal ml-1">({c.questionNumbers.map((n) => `Q${n}`).join(", ")})</span>
                  </div>
                  <div className={`text-xs font-medium ${changeColor(c.changePct)}`}>
                    {changePrefix(c.changePct)}{c.changePct}%
                  </div>
                </div>
                <div className="space-y-2">
                  {/* Pre bar — light */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-navy-400 w-9 shrink-0">Pre</span>
                    <div className="flex-1 bg-gray-100 rounded h-6 overflow-hidden">
                      <div
                        className="h-full bg-teal-200 rounded flex items-center justify-end px-2"
                        style={{ width: `${Math.max(Math.min(c.preCorrectPct, 100), 10)}%` }}
                      >
                        <span className="text-xs text-teal-800 font-semibold">{c.preCorrectPct}%</span>
                      </div>
                    </div>
                  </div>
                  {/* Post bar — dark */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-navy-400 w-9 shrink-0">Post</span>
                    <div className="flex-1 bg-gray-100 rounded h-6 overflow-hidden">
                      <div
                        className="h-full bg-teal-600 rounded flex items-center justify-end px-2"
                        style={{ width: `${Math.max(Math.min(c.postCorrectPct, 100), 10)}%` }}
                      >
                        <span className="text-xs text-white font-semibold">{c.postCorrectPct}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 mt-3 text-xs text-navy-400">
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-teal-200 rounded inline-block" /> Pre</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-teal-600 rounded inline-block" /> Post</span>
          </div>
        </div>
      )}

      {/* Two-column layout for practice settings + employers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Practice Settings */}
        {summary.practiceSettings.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-sm font-semibold text-navy-600 mb-3">Practice Setting Breakdown</h3>
            <div className="space-y-2">
              {summary.practiceSettings.slice(0, 8).map((ps) => (
                <div key={ps.setting} className="flex items-center justify-between text-sm">
                  <span className="text-navy-600 truncate mr-2" title={ps.setting}>{ps.setting}</span>
                  <span className="text-navy-500 whitespace-nowrap">{ps.count} ({ps.pct}%)</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top Employers */}
        {summary.topEmployers.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-sm font-semibold text-navy-600 mb-3">Top Employers</h3>
            <div className="space-y-2">
              {summary.topEmployers.slice(0, 8).map((emp, i) => (
                <div key={emp.employer} className="flex items-center justify-between text-sm">
                  <span className="text-navy-600 truncate mr-2" title={emp.employer}>
                    {i === 0 && <span className="text-amber-500 mr-1">★</span>}
                    {emp.employer}
                  </span>
                  <span className="text-navy-500">{emp.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Presenter Questions */}
      {summary.presenterQuestionCount > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-navy-600">Presenter Questions</h3>
            <span className="text-lg font-bold text-navy-700">{summary.presenterQuestionCount}</span>
          </div>
        </div>
      )}

      {/* Two-column: Intended Changes + Barriers */}
      {(summary.intendedChanges.length > 0 || summary.barriers.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {summary.intendedChanges.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-sm font-semibold text-navy-600 mb-3">Most Common Intended Changes</h3>
              <ol className="space-y-2">
                {summary.intendedChanges.slice(0, 5).map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-teal-600 font-medium mt-px">{i + 1}.</span>
                    <span className="text-navy-600 flex-1">{item.text}</span>
                    <span className="text-navy-400 text-xs whitespace-nowrap">({item.count})</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {(summary.barriers.length > 0 || summary.noBarrierItem) && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-sm font-semibold text-navy-600 mb-3">Most Common Barriers</h3>
              <ol className="space-y-2">
                {summary.barriers.slice(0, 5).map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-red-500 font-medium mt-px">{i + 1}.</span>
                    <span className="text-navy-600 flex-1">{item.text}</span>
                    <span className="text-navy-400 text-xs whitespace-nowrap">({item.count})</span>
                  </li>
                ))}
              </ol>
              {summary.noBarrierItem && (
                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-sm text-navy-400">
                  <span>{summary.noBarrierItem.text}</span>
                  <span className="text-xs">({summary.noBarrierItem.count})</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="font-medium text-amber-700 mb-2 text-sm">Warnings ({warnings.length}):</p>
          <ul className="text-sm text-amber-600 space-y-1">
            {warnings.slice(0, 10).map((w, i) => (
              <li key={i}>{w}</li>
            ))}
            {warnings.length > 10 && (
              <li>...and {warnings.length - 10} more</li>
            )}
          </ul>
        </div>
      )}

      {/* Errors */}
      {errors.length > 0 && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="font-medium text-red-700 mb-2 text-sm">Errors ({errors.length}):</p>
          <ul className="text-sm text-red-600 space-y-1">
            {errors.slice(0, 10).map((e, i) => (
              <li key={i}>{e}</li>
            ))}
            {errors.length > 10 && (
              <li>...and {errors.length - 10} more</li>
            )}
          </ul>
        </div>
      )}

      {/* Import status banner */}
      {errors.length === 0 ? (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
          <svg className="w-5 h-5 text-green-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-green-700">Import completed successfully</p>
            <p className="text-xs text-green-600 mt-0.5">Data has been saved to the database and is available across all analytics pages.</p>
          </div>
        </div>
      ) : (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <svg className="w-5 h-5 text-red-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-red-700">Import completed with errors</p>
            <p className="text-xs text-red-600 mt-0.5">Some records may not have been saved. Review the errors above.</p>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <a
          href="/program-catalog"
          className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700 inline-flex items-center gap-2"
        >
          View in Program Catalog
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </a>
        <button
          onClick={onReset}
          className="px-4 py-2 border border-gray-300 text-navy-600 rounded-lg text-sm hover:bg-navy-50"
        >
          Import Another File
        </button>
      </div>
    </div>
  );
}

// ── Small helper component ──

function MetricCard({
  value,
  label,
  sublabel,
  bg,
  text,
  subtext,
}: {
  value: number;
  label: string;
  sublabel: string;
  bg: string;
  text: string;
  subtext: string;
}) {
  return (
    <div className={`text-center p-3 ${bg} rounded-lg`}>
      <div className={`text-2xl font-bold ${text}`}>{value}</div>
      <div className={`text-xs ${subtext} font-medium`}>{label}</div>
      <div className={`text-[10px] ${subtext} opacity-70`}>{sublabel}</div>
    </div>
  );
}
