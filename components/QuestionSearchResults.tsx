import type { QuestionSearchResult, IdenticalQuestionGroup } from "@/lib/queries/catalog";

export function SearchResults({ results }: { results: QuestionSearchResult[] }) {
  if (results.length === 0) return <p className="text-navy-400">No results found.</p>;

  return (
    <div className="space-y-3">
      {results.map((r, i) => (
        <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="font-medium text-navy-800">{r.question_text}</p>
          <div className="mt-2 flex gap-3 text-sm text-navy-400">
            <span>Activity: <span className="font-medium text-navy-600">{r.activity_name}</span></span>
            <span className="px-2 py-0.5 bg-teal-100 text-teal-700 rounded text-xs">{r.question_type}</span>
            {r.question_category && (
              <span className="px-2 py-0.5 bg-navy-50 text-navy-500 rounded text-xs">{r.question_category}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export function IdenticalResults({ groups }: { groups: IdenticalQuestionGroup[] }) {
  if (groups.length === 0) return <p className="text-navy-400">No identical questions found across activities.</p>;

  return (
    <div className="space-y-4">
      {groups.map((g, i) => (
        <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="font-medium text-navy-800 mb-2">{g.question_text}</p>
          <div className="flex flex-wrap gap-2">
            {g.activities.map((a) => (
              <span key={a.activity_id} className="px-2 py-1 bg-accent-50 text-accent-700 rounded text-sm">
                {a.activity_name}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
