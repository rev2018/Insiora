interface Props {
  loaded: boolean;
  fileName?: string;
  qualityScore?: number;
  onReset: () => void;
}

const SECTIONS = [
  { id: "quality", label: "Quality" },
  { id: "cleaning", label: "Cleaning" },
  { id: "kpis", label: "KPIs" },
  { id: "charts", label: "Charts" },
  { id: "insights", label: "Insights" },
  { id: "summary", label: "Summary" },
];

export default function Header({ loaded, fileName, qualityScore, onReset }: Props) {
  return (
    <header className="no-print sticky top-0 z-10 backdrop-blur bg-paper/90 border-b border-line">
      <div className="max-w-5xl mx-auto px-6 md:px-16 h-14 flex items-center justify-between">
        <button onClick={onReset} className="font-display text-lg tracking-tight">
          Insiora
        </button>

        {loaded && (
          <nav className="hidden md:flex items-center gap-5 text-xs font-body font-semibold uppercase tracking-wide text-muted">
            {SECTIONS.map((s) => (
              <a key={s.id} href={`#${s.id}`} className="hover:text-ink transition-colors">
                {s.label}
              </a>
            ))}
          </nav>
        )}

        <div className="flex items-center gap-3 text-xs">
          {loaded && fileName && (
            <span className="hidden sm:inline text-muted font-mono truncate max-w-[140px]">{fileName}</span>
          )}
          {loaded && typeof qualityScore === "number" && (
            <span className="ledger-num text-xs border border-line rounded-sm px-2 py-1">{qualityScore}/100</span>
          )}
          {loaded && (
            <button onClick={onReset} className="btn-ghost !px-3 !py-1.5">
              New file
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
