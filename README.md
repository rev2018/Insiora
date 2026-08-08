# Insiora

Upload a CSV. Get a data quality audit, cleaning recommendations, auto-detected KPIs,
statistics, correlation analysis, and a written executive summary — entirely client-side,
no backend, no data leaves the browser.

## Run it

```bash
npm install
npm run dev
```

Open the local URL Vite prints (usually `http://localhost:5173`).

## Build for deployment

```bash
npm run build
```

Outputs a static site to `dist/` — drag that folder into Netlify, or connect the repo
directly (same flow as any static Vite/React site). No environment variables or backend
needed since all analysis runs in-browser.

## What it actually does

- **Profiling** — row/column counts, type inference, missing values, duplicate rows, memory estimate.
- **Data quality score** — 0–100, weighted across completeness, uniqueness, consistency, validity.
- **Cleaning recommendations** — every issue found gets a specific suggested fix (median/mean fill,
  dedupe, trim whitespace, standardize casing, cap outliers). Nothing is applied automatically —
  you choose per-column, then apply.
- **KPI detection** — scans column names for revenue/orders/customers/profit/units patterns and
  computes the relevant business metrics automatically.
- **Charts** — bar, pie, line (time trend), histogram, and scatter, all driven by dropdowns over
  the actual detected columns.
- **Statistics** — mean, median, mode, std dev, variance, quartiles, skewness, kurtosis per numeric column.
- **Correlation** — full Pearson correlation matrix plus a plain-language readout of the strongest
  relationships.
- **Insights** — rule-based (not LLM) observations generated from the actual computed stats:
  skew warnings, outlier flags, category concentration, correlation callouts.
- **Executive summary** — assembled from the real numbers above, exportable as a PDF.

## Stack

React + TypeScript + Vite + Tailwind CSS + Framer Motion + Recharts + PapaParse + jsPDF.

## Notes for extending

- All analysis logic lives in `src/lib/analysis.ts` — pure functions, no React, fully testable.
- To add a live backend later (FastAPI + Postgres, per the original spec), the cleanest path is
  porting `analysis.ts`'s logic to Pandas/NumPy on the server and keeping this frontend as the
  presentation layer — the function signatures already map closely to that split.
