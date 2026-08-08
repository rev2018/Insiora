import { CorrelationPair, Insight } from "../lib/analysis";

function heatColor(r: number) {
  const abs = Math.abs(r);
  if (r === 1) return "#14161A";
  if (abs < 0.1) return "#F6F6F3";
  const alpha = Math.min(abs, 1);
  return r > 0 ? `rgba(40, 98, 63, ${alpha})` : `rgba(174, 74, 36, ${alpha})`;
}

export default function InsightsSection({
  correlationCols,
  correlationValues,
  pairs,
  insights,
}: {
  correlationCols: string[];
  correlationValues: number[][];
  pairs: CorrelationPair[];
  insights: Insight[];
}) {
  return (
    <section id="insights" className="max-w-5xl mx-auto px-6 md:px-16 py-20 border-t border-line">
      <div className="eyebrow mb-4">06 — Correlation &amp; Business Insights</div>

      {correlationCols.length >= 2 && (
        <div className="mb-14 overflow-x-auto">
          <div className="eyebrow mb-3">Correlation matrix</div>
          <table className="border-collapse text-[11px]">
            <thead>
              <tr>
                <td />
                {correlationCols.map((c) => (
                  <th key={c} className="p-2 font-mono text-muted font-normal align-bottom" style={{ writingMode: "vertical-rl" }}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {correlationCols.map((rowName, i) => (
                <tr key={rowName}>
                  <th className="p-2 pr-3 font-mono text-muted font-normal text-right whitespace-nowrap">{rowName}</th>
                  {correlationCols.map((_, j) => (
                    <td
                      key={j}
                      className="w-12 h-12 text-center ledger-num"
                      style={{ backgroundColor: heatColor(correlationValues[i][j]), color: Math.abs(correlationValues[i][j]) > 0.5 ? "#F6F6F3" : "#14161A" }}
                    >
                      {correlationValues[i][j].toFixed(2)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[12px] text-muted mt-3 max-w-lg">
            Pearson correlation coefficient between each pair of numeric columns. Values near ±1
            indicate a strong linear relationship; values near 0 indicate none.
          </p>
        </div>
      )}

      {pairs.length > 0 && (
        <div className="mb-14">
          <div className="eyebrow mb-3">Notable relationships</div>
          <div className="space-y-3">
            {pairs.slice(0, 6).map((p, i) => (
              <div key={i} className="flex items-baseline gap-3 text-sm">
                <span className="ledger-num text-xs text-muted w-12 shrink-0">{p.r.toFixed(2)}</span>
                <span>
                  <strong className="font-medium">{p.colA}</strong> and{" "}
                  <strong className="font-medium">{p.colB}</strong> —{" "}
                  <span className="text-muted">
                    {p.strength} {p.direction} relationship
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="eyebrow mb-3">Generated insights</div>
        <div className="space-y-4">
          {insights.map((ins, i) => (
            <div key={i} className="flex gap-4 border-b border-line pb-4">
              <span
                className={`font-body font-semibold text-[10px] uppercase tracking-wide shrink-0 w-24 pt-0.5 ${
                  ins.severity === "warning" ? "text-alert" : ins.severity === "positive" ? "text-signal" : "text-muted"
                }`}
              >
                {ins.category}
              </span>
              <p className="text-sm leading-relaxed">{ins.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
