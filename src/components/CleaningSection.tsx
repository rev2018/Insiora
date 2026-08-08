import { CleaningSuggestion, Dataset } from "../lib/analysis";
import Papa from "papaparse";

interface Props {
  suggestions: CleaningSuggestion[];
  choices: Record<string, string>;
  onChoice: (key: string, optionId: string) => void;
  onApply: () => void;
  applied: boolean;
  beforeAfter: { beforeRows: number; afterRows: number; beforeCols: number; afterCols: number } | null;
  cleanedDataset: Dataset | null;
  fileName: string;
}

export default function CleaningSection({
  suggestions,
  choices,
  onChoice,
  onApply,
  applied,
  beforeAfter,
  cleanedDataset,
  fileName,
}: Props) {
  const downloadCSV = () => {
    if (!cleanedDataset) return;
    const csv = Papa.unparse({ fields: cleanedDataset.headers, data: cleanedDataset.rows.map((r) => cleanedDataset.headers.map((h) => r[h] ?? "")) });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const base = fileName ? fileName.replace(/\.csv$/i, "") : "dataset";
    a.href = url;
    a.download = `${base}-cleaned.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (suggestions.length === 0) {
    return (
      <section id="cleaning" className="max-w-5xl mx-auto px-6 md:px-16 py-20 border-t border-line">
        <div className="eyebrow mb-4">03 — Cleaning Recommendations</div>
        <p className="text-muted text-sm">No cleaning issues detected — this dataset is ready to analyze as-is.</p>
      </section>
    );
  }

  return (
    <section id="cleaning" className="max-w-5xl mx-auto px-6 md:px-16 py-20 border-t border-line">
      <div className="flex items-baseline justify-between flex-wrap gap-4 mb-8">
        <div className="eyebrow">03 — Cleaning Recommendations</div>
        <button className="btn-primary" onClick={onApply}>
          {applied ? "Re-apply selections" : "Apply selected fixes"}
        </button>
      </div>

      <p className="text-sm text-muted max-w-2xl mb-8">
        Insiora doesn't clean anything automatically. Review each recommendation and choose how to
        handle it — every downstream chart, KPI, and stat updates from the cleaned version once
        you apply.
      </p>

      <div className="space-y-6">
        {suggestions.map((s) => {
          const key = `${s.column}__${s.issue}`;
          const current = choices[key] ?? s.defaultOptionId;
          return (
            <div key={key} className="panel p-5">
              <div className="flex items-baseline justify-between flex-wrap gap-2 mb-1">
                <div className="font-medium text-sm">
                  {s.column} <span className="text-muted font-normal">— {s.issue}</span>
                </div>
              </div>
              <p className="text-[13px] text-muted mb-3">{s.detail}</p>
              <div className="flex flex-wrap gap-2">
                {s.options.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => onChoice(key, opt.id)}
                    className={`px-3 py-1.5 text-xs rounded-sm border transition-colors ${
                      current === opt.id
                        ? "bg-ink text-paper border-ink"
                        : "border-line text-muted hover:border-ink hover:text-ink"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {applied && beforeAfter && (
        <div className="mt-10 flex flex-col md:flex-row md:items-end gap-6">
          <div className="grid grid-cols-2 gap-6 max-w-md panel p-6">
            <div>
              <div className="eyebrow mb-2">Before</div>
              <div className="ledger-num text-sm">{beforeAfter.beforeRows.toLocaleString()} rows</div>
              <div className="ledger-num text-sm">{beforeAfter.beforeCols} columns</div>
            </div>
            <div>
              <div className="eyebrow mb-2 text-signal">After</div>
              <div className="ledger-num text-sm">{beforeAfter.afterRows.toLocaleString()} rows</div>
              <div className="ledger-num text-sm">{beforeAfter.afterCols} columns</div>
            </div>
          </div>
          <button className="btn-primary" onClick={downloadCSV}>
            Download cleaned CSV
          </button>
        </div>
      )}
    </section>
  );
}
