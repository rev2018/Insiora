import { KPI } from "../lib/analysis";

export default function KpiSection({ kpis }: { kpis: KPI[] }) {
  return (
    <section id="kpis" className="max-w-5xl mx-auto px-6 md:px-16 py-20 border-t border-line">
      <div className="eyebrow mb-4">04 — Detected KPIs</div>
      {kpis.length === 0 ? (
        <p className="text-muted text-sm max-w-lg">
          No standard business columns (revenue, orders, customers, profit) were detected by name —
          KPI auto-generation needs at least one recognizable column to anchor to.
        </p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-px bg-line border border-line">
          {kpis.map((k) => (
            <div key={k.label} className="bg-panel p-6">
              <div className="text-muted text-xs mb-2">{k.label}</div>
              <div className="font-display text-3xl">{k.value}</div>
              {k.sub && <div className="text-muted text-[11px] font-mono mt-1.5">{k.sub}</div>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
