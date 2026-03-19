"use client";

interface ColumnGroupToggleProps {
  groups: { id: string; label: string }[];
  active: Set<string>;
  onChange: (active: Set<string>) => void;
}

export default function ColumnGroupToggle({ groups, active, onChange }: ColumnGroupToggleProps) {
  const toggle = (id: string) => {
    const next = new Set(active);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };

  return (
    <div className="flex flex-wrap gap-2">
      {groups.map((g) => (
        <button
          key={g.id}
          onClick={() => toggle(g.id)}
          className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
            active.has(g.id)
              ? "bg-teal-500 text-white"
              : "bg-navy-100 text-navy-500 hover:bg-navy-200"
          }`}
        >
          {g.label}
        </button>
      ))}
    </div>
  );
}
