import { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Dataset, ProfileResult, NumericStats } from "../lib/analysis";

const PALETTE = ["#28623F", "#AE4A24", "#8A6D00", "#63666E", "#14161A", "#5C8A73"];

function isMissing(v: string) {
  const t = (v ?? "").trim().toLowerCase();
  return ["", "na", "n/a", "null", "none", "nan", "-", "--", "?"].includes(t);
}
function toNum(v: string) {
  return Number((v ?? "").trim().replace(/,/g, ""));
}

export default function ChartsSection({
  ds,
  profile,
  stats,
}: {
  ds: Dataset;
  profile: ProfileResult;
  stats: NumericStats[];
}) {
  const categoricalCols = profile.columns.filter((c) => c.type === "categorical");
  const numericCols = profile.columns.filter((c) => c.type === "numeric");
  const dateCol = profile.columns.find((c) => c.type === "date")?.name ?? null;

  const [catCol, setCatCol] = useState(categoricalCols[0]?.name ?? "");
  const [numCol, setNumCol] = useState(numericCols[0]?.name ?? "");
  const [scatterX, setScatterX] = useState(numericCols[0]?.name ?? "");
  const [scatterY, setScatterY] = useState(numericCols[1]?.name ?? numericCols[0]?.name ?? "");

  const barData = useMemo(() => {
    if (!catCol || !numCol) return [];
    const sums = new Map<string, number>();
    ds.rows.forEach((r) => {
      const cat = (r[catCol] ?? "").trim();
      const val = toNum(r[numCol]);
      if (!cat || isNaN(val)) return;
      sums.set(cat, (sums.get(cat) ?? 0) + val);
    });
    return [...sums.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 12);
  }, [ds, catCol, numCol]);

  const pieData = useMemo(() => {
    if (!catCol) return [];
    const counts = new Map<string, number>();
    ds.rows.forEach((r) => {
      const cat = (r[catCol] ?? "").trim();
      if (!cat) return;
      counts.set(cat, (counts.get(cat) ?? 0) + 1);
    });
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    const top = sorted.slice(0, 6);
    const rest = sorted.slice(6).reduce((a, [, c]) => a + c, 0);
    const data = top.map(([name, value]) => ({ name, value }));
    if (rest > 0) data.push({ name: "Other", value: rest });
    return data;
  }, [ds, catCol]);

  const trendData = useMemo(() => {
    if (!dateCol || !numCol) return [];
    const byMonth = new Map<string, number>();
    ds.rows.forEach((r) => {
      const d = new Date(r[dateCol]);
      const val = toNum(r[numCol]);
      if (isNaN(d.getTime()) || isNaN(val)) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      byMonth.set(key, (byMonth.get(key) ?? 0) + val);
    });
    return [...byMonth.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([name, value]) => ({ name, value }));
  }, [ds, dateCol, numCol]);

  const histogramData = useMemo(() => {
    if (!numCol) return [];
    const nums = ds.rows.map((r) => r[numCol]).filter((v) => !isMissing(v)).map(toNum).filter((n) => !isNaN(n));
    if (nums.length === 0) return [];
    const min = Math.min(...nums);
    const max = Math.max(...nums);
    const bins = 10;
    const width = (max - min) / bins || 1;
    const counts = new Array(bins).fill(0);
    nums.forEach((n) => {
      let idx = Math.floor((n - min) / width);
      if (idx >= bins) idx = bins - 1;
      if (idx < 0) idx = 0;
      counts[idx]++;
    });
    return counts.map((count, i) => ({
      name: `${(min + i * width).toFixed(0)}–${(min + (i + 1) * width).toFixed(0)}`,
      count,
    }));
  }, [ds, numCol]);

  const scatterData = useMemo(() => {
    if (!scatterX || !scatterY) return [];
    return ds.rows
      .map((r) => ({ x: toNum(r[scatterX]), y: toNum(r[scatterY]) }))
      .filter((p) => !isNaN(p.x) && !isNaN(p.y))
      .slice(0, 500);
  }, [ds, scatterX, scatterY]);

  return (
    <section id="charts" className="max-w-5xl mx-auto px-6 md:px-16 py-20 border-t border-line">
      <div className="eyebrow mb-4">05 — Exploratory Charts</div>

      <div className="flex flex-wrap gap-4 mb-10 text-xs">
        {categoricalCols.length > 0 && (
          <Selector label="Category" value={catCol} onChange={setCatCol} options={categoricalCols.map((c) => c.name)} />
        )}
        {numericCols.length > 0 && (
          <Selector label="Measure" value={numCol} onChange={setNumCol} options={numericCols.map((c) => c.name)} />
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-10">
        {barData.length > 0 && (
          <ChartCard title={`${numCol} by ${catCol}`} caption={`Top ${barData.length} categories ranked by total ${numCol}.`}>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={barData} margin={{ left: 0, right: 8, top: 8, bottom: 8 }}>
                <CartesianGrid stroke="#E2E2DC" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#63666E" }} interval={0} angle={-25} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 10, fill: "#63666E" }} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 3, border: "1px solid #E2E2DC" }} />
                <Bar dataKey="value" fill="#28623F" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {pieData.length > 0 && (
          <ChartCard title={`Row share by ${catCol}`} caption="Distribution of records across the top categories.">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={{ fontSize: 10 }}>
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 3, border: "1px solid #E2E2DC" }} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {trendData.length > 1 && (
          <ChartCard title={`${numCol} over time`} caption="Monthly totals across the full date range in the dataset.">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={trendData} margin={{ left: 0, right: 8, top: 8, bottom: 8 }}>
                <CartesianGrid stroke="#E2E2DC" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#63666E" }} />
                <YAxis tick={{ fontSize: 10, fill: "#63666E" }} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 3, border: "1px solid #E2E2DC" }} />
                <Line type="monotone" dataKey="value" stroke="#AE4A24" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {histogramData.length > 0 && (
          <ChartCard title={`Distribution of ${numCol}`} caption="Frequency histogram, 10 equal-width bins.">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={histogramData} margin={{ left: 0, right: 8, top: 8, bottom: 8 }}>
                <CartesianGrid stroke="#E2E2DC" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#63666E" }} interval={0} angle={-30} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 10, fill: "#63666E" }} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 3, border: "1px solid #E2E2DC" }} />
                <Bar dataKey="count" fill="#8A6D00" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {numericCols.length >= 2 && (
          <ChartCard
            title="Scatter"
            caption="Pick two numeric columns to inspect for a relationship."
            controls={
              <div className="flex gap-2">
                <Selector compact label="X" value={scatterX} onChange={setScatterX} options={numericCols.map((c) => c.name)} />
                <Selector compact label="Y" value={scatterY} onChange={setScatterY} options={numericCols.map((c) => c.name)} />
              </div>
            }
          >
            <ResponsiveContainer width="100%" height={260}>
              <ScatterChart margin={{ left: 0, right: 8, top: 8, bottom: 8 }}>
                <CartesianGrid stroke="#E2E2DC" />
                <XAxis dataKey="x" name={scatterX} tick={{ fontSize: 10, fill: "#63666E" }} />
                <YAxis dataKey="y" name={scatterY} tick={{ fontSize: 10, fill: "#63666E" }} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 3, border: "1px solid #E2E2DC" }} cursor={{ strokeDasharray: "3 3" }} />
                <Scatter data={scatterData} fill="#28623F" />
              </ScatterChart>
            </ResponsiveContainer>
          </ChartCard>
        )}
      </div>

      {stats.length > 0 && (
        <div className="mt-16">
          <div className="eyebrow mb-4">Descriptive statistics</div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs ledger-num border-collapse">
              <thead>
                <tr className="border-b border-ink text-left">
                  <th className="py-2 pr-4 font-mono text-muted font-normal">Column</th>
                  <th className="py-2 pr-4 font-mono text-muted font-normal">Mean</th>
                  <th className="py-2 pr-4 font-mono text-muted font-normal">Median</th>
                  <th className="py-2 pr-4 font-mono text-muted font-normal">Std Dev</th>
                  <th className="py-2 pr-4 font-mono text-muted font-normal">Min</th>
                  <th className="py-2 pr-4 font-mono text-muted font-normal">Max</th>
                  <th className="py-2 pr-4 font-mono text-muted font-normal">Q1</th>
                  <th className="py-2 pr-4 font-mono text-muted font-normal">Q3</th>
                  <th className="py-2 pr-4 font-mono text-muted font-normal">Skew</th>
                  <th className="py-2 font-mono text-muted font-normal">Kurtosis</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((s) => (
                  <tr key={s.column} className="border-b border-line">
                    <td className="py-2 pr-4 font-body font-medium">{s.column}</td>
                    <td className="py-2 pr-4">{s.mean.toFixed(2)}</td>
                    <td className="py-2 pr-4">{s.median.toFixed(2)}</td>
                    <td className="py-2 pr-4">{s.std.toFixed(2)}</td>
                    <td className="py-2 pr-4">{s.min.toFixed(2)}</td>
                    <td className="py-2 pr-4">{s.max.toFixed(2)}</td>
                    <td className="py-2 pr-4">{s.q1.toFixed(2)}</td>
                    <td className="py-2 pr-4">{s.q3.toFixed(2)}</td>
                    <td className="py-2 pr-4">{s.skewness.toFixed(2)}</td>
                    <td className="py-2">{s.kurtosis.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

function ChartCard({
  title,
  caption,
  controls,
  children,
}: {
  title: string;
  caption: string;
  controls?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="panel p-5">
      <div className="flex items-start justify-between gap-4 mb-1">
        <div className="font-display text-lg">{title}</div>
        {controls}
      </div>
      <p className="text-[12px] text-muted mb-3">{caption}</p>
      {children}
    </div>
  );
}

function Selector({
  label,
  value,
  onChange,
  options,
  compact,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  compact?: boolean;
}) {
  return (
    <label className={`flex items-center gap-2 ${compact ? "" : "border border-line rounded-sm px-3 py-1.5"}`}>
      <span className="text-muted font-mono uppercase text-[10px] tracking-wide">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent text-xs font-medium outline-none cursor-pointer"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}
