interface DataPreviewTableProps {
  headers: string[];
  rows: Record<string, unknown>[];
  maxRows?: number;
}

export default function DataPreviewTable({
  headers,
  rows,
  maxRows = 10,
}: DataPreviewTableProps) {
  const displayRows = rows.slice(0, maxRows);

  return (
    <div className="overflow-x-auto border rounded-lg">
      <table className="min-w-full text-sm">
        <thead className="bg-navy-50">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-4 py-2 text-left font-medium text-navy-500 whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {displayRows.map((row, i) => (
            <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-navy-50"}>
              {headers.map((h) => (
                <td key={h} className="px-4 py-2 whitespace-nowrap text-navy-600">
                  {String(row[h] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > maxRows && (
        <div className="px-4 py-2 text-sm text-navy-400 bg-navy-50 border-t">
          Showing {maxRows} of {rows.length} rows
        </div>
      )}
    </div>
  );
}
