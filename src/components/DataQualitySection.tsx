import { ProfileResult } from "../lib/analysis";

function scoreColor(score: number) {
  if (score >= 80) return "text-signal";
  if (score >= 60) return "text-flag";
  return "text-alert";
}

function severityDot(sev: "low" | "medium" | "high") {
  const cls = sev === "high" ? "bg-alert" : sev === "medium" ? "bg-flag" : "bg-muted";
  return <span className={`inline-block w-1.5 h-1.5 rounded-full ${cls} mr-2 shrink-0 mt-1.5`} />;
}

interface Props {
  profile: ProfileResult;
  isCleanedView?: boolean;
}

export default function DataQualitySection({ profile, isCleanedView }: Props) {
  return (
    <section id="quality" className="max-w-5xl mx-auto px-6 md:px-16 py-20 border-t border-line">
      <div className="flex items-baseline gap-3 mb-4">
        <div className="eyebrow">02 — Data Quality Audit</div>
        {isCleanedView && (
          <span className="font-body font-semibold text-[10px] uppercase tracking-wide text-signal border border-signal/40 bg-signal-soft rounded-sm px-2 py-0.5">
            Showing cleaned data
          </span>
        )}
      </div>

      <div className="grid md:grid-cols-[220px_1fr] gap-10 items-start">
        <div>
          <div className={`font-display text-7xl ${scoreColor(profile.qualityScore)}`}>
            {profile.qualityScore}
          </div>
          <div className="text-muted text-sm mt-1">out of 100</div>
          <div className="mt-6 space-y-2">
            {profile.qualityBreakdown.map((b) => (
              <div key={b.label} className="flex items-center justify-between text-xs">
                <span className="text-muted">{b.label}</span>
                <span className="ledger-num">{b.score}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
            <Stat label="Rows" value={profile.rowCount.toLocaleString()} />
            <Stat label="Columns" value={profile.colCount.toString()} />
            <Stat label="Duplicate rows" value={profile.duplicateRowCount.toLocaleString()} warn={profile.duplicateRowCount > 0} />
            <Stat label="Est. memory" value={`${profile.memoryEstimateKB} KB`} />
          </div>

          <div className="eyebrow mb-3">Column profile</div>
          <div className="border-t border-line">
            {profile.columns.map((col) => (
              <div key={col.name} className="border-b border-line py-3 grid grid-cols-[1fr_auto] gap-4">
                <div>
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="font-medium text-sm">{col.name}</span>
                    <span className="font-body font-semibold text-[10px] uppercase tracking-wide text-muted border border-line rounded-sm px-1.5 py-0.5">
                      {col.type}
                    </span>
                  </div>
                  {col.issues.length > 0 ? (
                    <ul className="mt-1.5 space-y-1">
                      {col.issues.map((iss, i) => (
                        <li key={i} className="flex text-[12.5px] text-muted leading-snug">
                          {severityDot(iss.severity)}
                          {iss.message}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[12.5px] text-muted mt-1.5">No issues detected.</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <div className="ledger-num text-xs text-muted">{(col.missingPct * 100).toFixed(0)}% missing</div>
                  <div className="ledger-num text-xs text-muted mt-0.5">{col.unique.toLocaleString()} unique</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div>
      <div className={`font-mono text-2xl ${warn ? "text-alert" : "text-ink"}`}>{value}</div>
      <div className="text-muted text-xs mt-0.5">{label}</div>
    </div>
  );
}
