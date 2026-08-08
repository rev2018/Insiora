// Insiora analysis engine — everything here is deterministic. No AI calls.
// This is the actual "product" of the app: real statistics computed on real data.

export type ColumnType = "numeric" | "categorical" | "date" | "boolean" | "text" | "constant";

export interface ColumnProfile {
  name: string;
  type: ColumnType;
  missing: number;
  missingPct: number;
  unique: number;
  uniquePct: number;
  sample: string[];
  issues: ColumnIssue[];
}

export interface ColumnIssue {
  kind:
    | "missing"
    | "duplicateRows"
    | "constant"
    | "highCardinality"
    | "inconsistentCase"
    | "whitespace"
    | "mixedType"
    | "outliers"
    | "negative";
  severity: "low" | "medium" | "high";
  message: string;
  count?: number;
}

export interface CleaningSuggestion {
  column: string;
  issue: string;
  detail: string;
  options: { id: string; label: string }[];
  defaultOptionId: string;
}

export interface Dataset {
  headers: string[];
  rows: Record<string, string>[];
}

export interface ProfileResult {
  rowCount: number;
  colCount: number;
  duplicateRowCount: number;
  memoryEstimateKB: number;
  columns: ColumnProfile[];
  qualityScore: number;
  qualityBreakdown: { label: string; score: number; weight: number }[];
}

const MISSING_TOKENS = new Set(["", "na", "n/a", "null", "none", "nan", "-", "--", "?", "unknown", "undefined"]);

function isMissing(v: string): boolean {
  if (v === null || v === undefined) return true;
  const t = v.trim().toLowerCase();
  return MISSING_TOKENS.has(t);
}

function looksNumeric(v: string): boolean {
  if (isMissing(v)) return false;
  const cleaned = v.trim().replace(/,/g, "");
  return cleaned !== "" && !isNaN(Number(cleaned));
}

function looksDate(v: string): boolean {
  if (isMissing(v)) return false;
  if (looksNumeric(v)) return false;
  const t = v.trim();
  if (!/[\d]{2,4}[-/][\d]{1,2}[-/][\d]{1,4}/.test(t) && !/^\d{4}-\d{2}-\d{2}/.test(t)) return false;
  const d = new Date(t);
  return !isNaN(d.getTime());
}

function looksBoolean(v: string): boolean {
  const t = v.trim().toLowerCase();
  return ["true", "false", "yes", "no", "y", "n", "0", "1"].includes(t);
}

export function inferColumnType(values: string[]): ColumnType {
  const nonMissing = values.filter((v) => !isMissing(v));
  if (nonMissing.length === 0) return "text";

  const uniqueVals = new Set(nonMissing.map((v) => v.trim().toLowerCase()));
  if (uniqueVals.size === 1) return "constant";

  const numericCount = nonMissing.filter(looksNumeric).length;
  const dateCount = nonMissing.filter(looksDate).length;
  const boolCount = nonMissing.filter(looksBoolean).length;

  const n = nonMissing.length;
  if (numericCount / n > 0.9) return "numeric";
  if (dateCount / n > 0.85) return "date";
  if (boolCount / n === 1 && uniqueVals.size <= 2) return "boolean";
  if (uniqueVals.size / n > 0.6 && n > 20) return "text";
  return "categorical";
}

function toNumber(v: string): number {
  return Number(v.trim().replace(/,/g, ""));
}

export function parseDataset(headers: string[], rawRows: Record<string, string>[]): Dataset {
  return { headers, rows: rawRows };
}

export function profileDataset(ds: Dataset): ProfileResult {
  const { headers, rows } = ds;
  const rowCount = rows.length;

  // duplicate row detection
  const rowKeys = rows.map((r) => headers.map((h) => (r[h] ?? "").trim().toLowerCase()).join("␟"));
  const seen = new Map<string, number>();
  rowKeys.forEach((k) => seen.set(k, (seen.get(k) ?? 0) + 1));
  const duplicateRowCount = [...seen.values()].reduce((acc, c) => acc + (c > 1 ? c - 1 : 0), 0);

  const columns: ColumnProfile[] = headers.map((h) => {
    const values = rows.map((r) => r[h] ?? "");
    const missingCount = values.filter(isMissing).length;
    const nonMissing = values.filter((v) => !isMissing(v));
    const uniqueVals = new Set(nonMissing.map((v) => v.trim()));
    const type = inferColumnType(values);

    const issues: ColumnIssue[] = [];

    if (missingCount > 0) {
      const pct = missingCount / rowCount;
      issues.push({
        kind: "missing",
        severity: pct > 0.3 ? "high" : pct > 0.05 ? "medium" : "low",
        message: `${missingCount} missing value${missingCount === 1 ? "" : "s"} (${(pct * 100).toFixed(1)}%)`,
        count: missingCount,
      });
    }

    if (type === "constant") {
      issues.push({
        kind: "constant",
        severity: "medium",
        message: "Every value in this column is identical — carries no analytical signal.",
      });
    }

    if (type === "text" && uniqueVals.size / Math.max(nonMissing.length, 1) > 0.9 && rowCount > 20) {
      issues.push({
        kind: "highCardinality",
        severity: "low",
        message: "Near-unique values in every row (likely an ID or free-text field).",
      });
    }

    if (type === "categorical") {
      const lowerMap = new Map<string, Set<string>>();
      nonMissing.forEach((v) => {
        const key = v.trim().toLowerCase();
        if (!lowerMap.has(key)) lowerMap.set(key, new Set());
        lowerMap.get(key)!.add(v.trim());
      });
      const inconsistent = [...lowerMap.values()].filter((s) => s.size > 1).length;
      if (inconsistent > 0) {
        issues.push({
          kind: "inconsistentCase",
          severity: "medium",
          message: `${inconsistent} label${inconsistent === 1 ? "" : "s"} appear with inconsistent capitalization (e.g. "US" vs "us").`,
          count: inconsistent,
        });
      }
    }

    const whitespaceCount = nonMissing.filter((v) => v !== v.trim()).length;
    if (whitespaceCount > 0) {
      issues.push({
        kind: "whitespace",
        severity: "low",
        message: `${whitespaceCount} value${whitespaceCount === 1 ? "" : "s"} have leading/trailing whitespace.`,
        count: whitespaceCount,
      });
    }

    if (type === "numeric") {
      const nums = nonMissing.map(toNumber).filter((n) => !isNaN(n));
      const negatives = nums.filter((n) => n < 0).length;
      const looksLikelyPositiveOnly = /price|amount|revenue|cost|quantity|qty|age|count|units|sales|profit/i.test(h);
      if (negatives > 0 && looksLikelyPositiveOnly) {
        issues.push({
          kind: "negative",
          severity: "medium",
          message: `${negatives} negative value${negatives === 1 ? "" : "s"} found in a column that looks like it should be non-negative.`,
          count: negatives,
        });
      }

      if (nums.length >= 5) {
        const { lower, upper } = iqrBounds(nums);
        const outliers = nums.filter((n) => n < lower || n > upper).length;
        if (outliers > 0) {
          issues.push({
            kind: "outliers",
            severity: outliers / nums.length > 0.1 ? "medium" : "low",
            message: `${outliers} statistical outlier${outliers === 1 ? "" : "s"} detected via IQR method.`,
            count: outliers,
          });
        }
      }
    }

    return {
      name: h,
      type,
      missing: missingCount,
      missingPct: rowCount ? missingCount / rowCount : 0,
      unique: uniqueVals.size,
      uniquePct: nonMissing.length ? uniqueVals.size / nonMissing.length : 0,
      sample: nonMissing.slice(0, 3),
      issues,
    };
  });

  const memoryEstimateKB = Math.round(
    (rows.reduce((acc, r) => acc + headers.reduce((a, h) => a + (r[h]?.length ?? 0), 0), 0) * 2) / 1024
  );

  const { qualityScore, qualityBreakdown } = computeQualityScore(columns, duplicateRowCount, rowCount);

  return { rowCount, colCount: headers.length, duplicateRowCount, memoryEstimateKB, columns, qualityScore, qualityBreakdown };
}

function iqrBounds(nums: number[]) {
  const sorted = [...nums].sort((a, b) => a - b);
  const q1 = percentile(sorted, 25);
  const q3 = percentile(sorted, 75);
  const iqr = q3 - q1;
  return { lower: q1 - 1.5 * iqr, upper: q3 + 1.5 * iqr, q1, q3, iqr };
}

export function percentile(sortedNums: number[], p: number): number {
  if (sortedNums.length === 0) return NaN;
  const idx = (p / 100) * (sortedNums.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sortedNums[lo];
  return sortedNums[lo] + (sortedNums[hi] - sortedNums[lo]) * (idx - lo);
}

function computeQualityScore(columns: ColumnProfile[], duplicateRowCount: number, rowCount: number) {
  // Completeness: inverse of overall missing rate
  const totalCells = columns.length * rowCount || 1;
  const missingCells = columns.reduce((acc, c) => acc + c.missing, 0);
  const completeness = 100 * (1 - missingCells / totalCells);

  // Uniqueness: penalize duplicate rows
  const duplicatePenalty = rowCount ? (duplicateRowCount / rowCount) * 100 : 0;
  const uniqueness = Math.max(0, 100 - duplicatePenalty * 2);

  // Consistency: penalize case inconsistency, whitespace, mixed issues
  const consistencyIssues = columns.reduce(
    (acc, c) => acc + c.issues.filter((i) => i.kind === "inconsistentCase" || i.kind === "whitespace").length,
    0
  );
  const consistency = Math.max(0, 100 - consistencyIssues * 8);

  // Validity: penalize negatives-where-invalid, outlier-heavy columns, constants
  const validityIssues = columns.reduce(
    (acc, c) => acc + c.issues.filter((i) => i.kind === "negative" || i.kind === "constant").length,
    0
  );
  const validity = Math.max(0, 100 - validityIssues * 10);

  const breakdown = [
    { label: "Completeness", score: Math.round(completeness), weight: 0.4 },
    { label: "Uniqueness", score: Math.round(uniqueness), weight: 0.2 },
    { label: "Consistency", score: Math.round(consistency), weight: 0.2 },
    { label: "Validity", score: Math.round(validity), weight: 0.2 },
  ];

  const qualityScore = Math.round(breakdown.reduce((acc, b) => acc + b.score * b.weight, 0));
  return { qualityScore, qualityBreakdown: breakdown };
}

export function buildCleaningSuggestions(profile: ProfileResult): CleaningSuggestion[] {
  const suggestions: CleaningSuggestion[] = [];

  profile.columns.forEach((col) => {
    col.issues.forEach((issue) => {
      if (issue.kind === "missing" && col.type === "numeric") {
        suggestions.push({
          column: col.name,
          issue: "Missing values",
          detail: issue.message,
          options: [
            { id: "median", label: "Fill with median" },
            { id: "mean", label: "Fill with mean" },
            { id: "drop", label: "Remove affected rows" },
            { id: "skip", label: "Leave as-is" },
          ],
          defaultOptionId: "median",
        });
      } else if (issue.kind === "missing") {
        suggestions.push({
          column: col.name,
          issue: "Missing values",
          detail: issue.message,
          options: [
            { id: "mode", label: "Fill with most frequent value" },
            { id: "unknown", label: "Fill with \"Unknown\"" },
            { id: "drop", label: "Remove affected rows" },
            { id: "skip", label: "Leave as-is" },
          ],
          defaultOptionId: "mode",
        });
      }
      if (issue.kind === "inconsistentCase") {
        suggestions.push({
          column: col.name,
          issue: "Inconsistent capitalization",
          detail: issue.message,
          options: [
            { id: "titlecase", label: "Standardize to Title Case" },
            { id: "skip", label: "Leave as-is" },
          ],
          defaultOptionId: "titlecase",
        });
      }
      if (issue.kind === "whitespace") {
        suggestions.push({
          column: col.name,
          issue: "Leading/trailing whitespace",
          detail: issue.message,
          options: [
            { id: "trim", label: "Trim whitespace" },
            { id: "skip", label: "Leave as-is" },
          ],
          defaultOptionId: "trim",
        });
      }
      if (issue.kind === "outliers") {
        suggestions.push({
          column: col.name,
          issue: "Statistical outliers",
          detail: issue.message,
          options: [
            { id: "cap", label: "Cap to IQR bounds (winsorize)" },
            { id: "flag", label: "Flag only, keep values" },
            { id: "skip", label: "Leave as-is" },
          ],
          defaultOptionId: "flag",
        });
      }
      if (issue.kind === "constant") {
        suggestions.push({
          column: col.name,
          issue: "Constant column",
          detail: issue.message,
          options: [
            { id: "drop_col", label: "Drop this column" },
            { id: "skip", label: "Keep anyway" },
          ],
          defaultOptionId: "drop_col",
        });
      }
    });
  });

  if (profile.duplicateRowCount > 0) {
    suggestions.unshift({
      column: "(all rows)",
      issue: "Duplicate rows",
      detail: `${profile.duplicateRowCount} duplicate row${profile.duplicateRowCount === 1 ? "" : "s"} detected across the full dataset.`,
      options: [
        { id: "dedupe", label: "Remove duplicate rows" },
        { id: "skip", label: "Leave as-is" },
      ],
      defaultOptionId: "dedupe",
    });
  }

  return suggestions;
}

export function applyCleaning(
  ds: Dataset,
  profile: ProfileResult,
  choices: Record<string, string>
): Dataset {
  let rows = ds.rows.map((r) => ({ ...r }));
  let headers = [...ds.headers];

  // dedupe
  if (choices["(all rows)__Duplicate rows"] === "dedupe") {
    const seen = new Set<string>();
    rows = rows.filter((r) => {
      const key = headers.map((h) => (r[h] ?? "").trim().toLowerCase()).join("␟");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  const colsToDrop = new Set<string>();

  profile.columns.forEach((col) => {
    const missingKey = `${col.name}__Missing values`;
    const caseKey = `${col.name}__Inconsistent capitalization`;
    const wsKey = `${col.name}__Leading/trailing whitespace`;
    const outlierKey = `${col.name}__Statistical outliers`;
    const constKey = `${col.name}__Constant column`;

    if (choices[constKey] === "drop_col") colsToDrop.add(col.name);

    if (choices[wsKey] === "trim") {
      rows.forEach((r) => {
        if (r[col.name] != null) r[col.name] = r[col.name].trim();
      });
    }

    if (choices[caseKey] === "titlecase") {
      rows.forEach((r) => {
        const v = r[col.name];
        if (v && !isMissing(v)) {
          r[col.name] = v
            .trim()
            .toLowerCase()
            .replace(/\b\w/g, (c) => c.toUpperCase());
        }
      });
    }

    if (choices[missingKey] === "drop") {
      rows = rows.filter((r) => !isMissing(r[col.name] ?? ""));
    } else if (choices[missingKey] === "median" || choices[missingKey] === "mean") {
      const nums = rows.map((r) => r[col.name]).filter((v) => !isMissing(v)).map(toNumber);
      const fillVal =
        choices[missingKey] === "median"
          ? percentile([...nums].sort((a, b) => a - b), 50)
          : nums.reduce((a, b) => a + b, 0) / (nums.length || 1);
      // If every value in the column was missing, there's nothing to average — fall back to 0
      // rather than writing "NaN" text into every cell.
      const safeFillVal = isNaN(fillVal) ? 0 : fillVal;
      rows.forEach((r) => {
        if (isMissing(r[col.name] ?? "")) r[col.name] = String(Math.round(safeFillVal * 100) / 100);
      });
    } else if (choices[missingKey] === "mode") {
      const freq = new Map<string, number>();
      rows.forEach((r) => {
        const v = r[col.name];
        if (!isMissing(v ?? "")) freq.set(v, (freq.get(v) ?? 0) + 1);
      });
      let modeVal = "";
      let max = 0;
      freq.forEach((c, v) => {
        if (c > max) {
          max = c;
          modeVal = v;
        }
      });
      // If every value in the column was missing, there's no mode to fall back to —
      // use "Unknown" rather than silently writing blank values.
      if (modeVal === "") modeVal = "Unknown";
      rows.forEach((r) => {
        if (isMissing(r[col.name] ?? "")) r[col.name] = modeVal;
      });
    } else if (choices[missingKey] === "unknown") {
      rows.forEach((r) => {
        if (isMissing(r[col.name] ?? "")) r[col.name] = "Unknown";
      });
    }

    if (choices[outlierKey] === "cap") {
      const nums = rows.map((r) => r[col.name]).filter((v) => !isMissing(v)).map(toNumber).filter((n) => !isNaN(n));
      if (nums.length >= 5) {
        const { lower, upper } = iqrBounds(nums);
        rows.forEach((r) => {
          const n = toNumber(r[col.name] ?? "");
          if (!isNaN(n)) {
            if (n < lower) r[col.name] = String(lower);
            if (n > upper) r[col.name] = String(upper);
          }
        });
      }
    }
  });

  if (colsToDrop.size > 0) {
    headers = headers.filter((h) => !colsToDrop.has(h));
    rows.forEach((r) => colsToDrop.forEach((c) => delete r[c]));
  }

  return { headers, rows };
}

// ---------- Statistics ----------

export interface NumericStats {
  column: string;
  count: number;
  mean: number;
  median: number;
  mode: number | null;
  std: number;
  variance: number;
  min: number;
  max: number;
  q1: number;
  q3: number;
  skewness: number;
  kurtosis: number;
}

export function computeNumericStats(ds: Dataset, profile: ProfileResult): NumericStats[] {
  return profile.columns
    .filter((c) => c.type === "numeric")
    .map((c) => {
      const nums = ds.rows.map((r) => r[c.name]).filter((v) => v && !isMissing(v)).map(toNumber).filter((n) => !isNaN(n));
      const sorted = [...nums].sort((a, b) => a - b);
      const mean = nums.reduce((a, b) => a + b, 0) / (nums.length || 1);
      const variance = nums.reduce((a, b) => a + (b - mean) ** 2, 0) / (nums.length || 1);
      const std = Math.sqrt(variance);
      const skewness =
        nums.length > 2 && std > 0
          ? (nums.reduce((a, b) => a + ((b - mean) / std) ** 3, 0) / nums.length)
          : 0;
      const kurtosis =
        nums.length > 3 && std > 0
          ? nums.reduce((a, b) => a + ((b - mean) / std) ** 4, 0) / nums.length - 3
          : 0;

      const freq = new Map<number, number>();
      nums.forEach((n) => freq.set(n, (freq.get(n) ?? 0) + 1));
      let mode: number | null = null;
      let max = 0;
      freq.forEach((c2, v) => {
        if (c2 > max && c2 > 1) {
          max = c2;
          mode = v;
        }
      });

      return {
        column: c.name,
        count: nums.length,
        mean,
        median: percentile(sorted, 50),
        mode,
        std,
        variance,
        min: sorted[0] ?? NaN,
        max: sorted[sorted.length - 1] ?? NaN,
        q1: percentile(sorted, 25),
        q3: percentile(sorted, 75),
        skewness,
        kurtosis,
      };
    });
}

export interface CorrelationPair {
  colA: string;
  colB: string;
  r: number;
  strength: "strong" | "moderate" | "weak";
  direction: "positive" | "negative";
}

export function pearsonCorrelation(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 2) return 0;
  const meanA = a.reduce((x, y) => x + y, 0) / n;
  const meanB = b.reduce((x, y) => x + y, 0) / n;
  let num = 0,
    denA = 0,
    denB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    num += da * db;
    denA += da * da;
    denB += db * db;
  }
  const den = Math.sqrt(denA * denB);
  return den === 0 ? 0 : num / den;
}

export function computeCorrelations(ds: Dataset, profile: ProfileResult): { matrix: string[][]; values: number[][]; pairs: CorrelationPair[] } {
  const numericCols = profile.columns.filter((c) => c.type === "numeric").map((c) => c.name);
  const colData: Record<string, number[]> = {};

  numericCols.forEach((c) => {
    colData[c] = ds.rows.map((r) => (isMissing(r[c] ?? "") ? NaN : toNumber(r[c])));
  });

  const values: number[][] = numericCols.map((a) =>
    numericCols.map((b) => {
      const pairsA: number[] = [];
      const pairsB: number[] = [];
      for (let i = 0; i < ds.rows.length; i++) {
        const va = colData[a][i];
        const vb = colData[b][i];
        if (!isNaN(va) && !isNaN(vb)) {
          pairsA.push(va);
          pairsB.push(vb);
        }
      }
      return Math.round(pearsonCorrelation(pairsA, pairsB) * 100) / 100;
    })
  );

  const pairs: CorrelationPair[] = [];
  for (let i = 0; i < numericCols.length; i++) {
    for (let j = i + 1; j < numericCols.length; j++) {
      const r = values[i][j];
      const abs = Math.abs(r);
      if (abs < 0.3) continue;
      pairs.push({
        colA: numericCols[i],
        colB: numericCols[j],
        r,
        strength: abs > 0.7 ? "strong" : abs > 0.5 ? "moderate" : "weak",
        direction: r >= 0 ? "positive" : "negative",
      });
    }
  }
  pairs.sort((a, b) => Math.abs(b.r) - Math.abs(a.r));

  return { matrix: numericCols.map((c) => [c]), values, pairs };
}

// ---------- KPI detection ----------

export interface KPI {
  label: string;
  value: string;
  sub?: string;
}

function findCol(headers: string[], patterns: RegExp[]): string | null {
  for (const p of patterns) {
    const hit = headers.find((h) => p.test(h));
    if (hit) return hit;
  }
  return null;
}

function fmtNum(n: number): string {
  if (!isFinite(n)) return "—";
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function detectKPIs(ds: Dataset, profile: ProfileResult): KPI[] {
  const headers = ds.headers;
  const kpis: KPI[] = [];

  const revenueCol = findCol(headers, [/revenue/i, /sales/i, /total.?amount/i, /price/i]);
  const orderCol = findCol(headers, [/order.?id/i, /transaction.?id/i, /invoice/i]);
  const customerCol = findCol(headers, [/customer/i, /client/i, /user.?id/i]);
  const profitCol = findCol(headers, [/profit/i, /margin/i]);
  const quantityCol = findCol(headers, [/qty/i, /quantity/i, /units/i]);
  const dateCol = profile.columns.find((c) => c.type === "date")?.name ?? null;

  if (revenueCol) {
    const nums = ds.rows.map((r) => r[revenueCol]).filter((v) => !isMissing(v ?? "")).map(toNumber).filter((n) => !isNaN(n));
    const total = nums.reduce((a, b) => a + b, 0);
    const avg = total / (nums.length || 1);
    kpis.push({ label: "Total Revenue", value: fmtNum(total), sub: revenueCol });
    kpis.push({ label: "Average Order Value", value: fmtNum(avg), sub: revenueCol });

    if (dateCol) {
      const byMonth = new Map<string, number>();
      ds.rows.forEach((r) => {
        const d = new Date(r[dateCol]);
        const rv = toNumber(r[revenueCol] ?? "0");
        if (!isNaN(d.getTime()) && !isNaN(rv)) {
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          byMonth.set(key, (byMonth.get(key) ?? 0) + rv);
        }
      });
      const sortedMonths = [...byMonth.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
      if (sortedMonths.length >= 2) {
        const first = sortedMonths[0][1];
        const last = sortedMonths[sortedMonths.length - 1][1];
        const growth = first !== 0 ? ((last - first) / Math.abs(first)) * 100 : 0;
        kpis.push({
          label: "Revenue Growth (first → last month)",
          value: `${growth >= 0 ? "+" : ""}${growth.toFixed(1)}%`,
          sub: `${sortedMonths[0][0]} → ${sortedMonths[sortedMonths.length - 1][0]}`,
        });
      }
    }
  }

  if (orderCol) {
    const uniqueOrders = new Set(ds.rows.map((r) => r[orderCol])).size;
    kpis.push({ label: "Total Orders", value: fmtNum(uniqueOrders), sub: orderCol });
  }

  if (customerCol) {
    const uniqueCustomers = new Set(ds.rows.map((r) => r[customerCol])).size;
    kpis.push({ label: "Total Customers", value: fmtNum(uniqueCustomers), sub: customerCol });

    const freq = new Map<string, number>();
    ds.rows.forEach((r) => {
      const v = r[customerCol];
      if (v) freq.set(v, (freq.get(v) ?? 0) + 1);
    });
    const returning = [...freq.values()].filter((c) => c > 1).length;
    const retentionRate = uniqueCustomers ? (returning / uniqueCustomers) * 100 : 0;
    kpis.push({ label: "Returning Customer Rate", value: `${retentionRate.toFixed(1)}%`, sub: `${returning} of ${uniqueCustomers}` });
  }

  if (profitCol) {
    const nums = ds.rows.map((r) => r[profitCol]).filter((v) => !isMissing(v ?? "")).map(toNumber).filter((n) => !isNaN(n));
    const total = nums.reduce((a, b) => a + b, 0);
    kpis.push({ label: "Net Profit", value: fmtNum(total), sub: profitCol });
    if (revenueCol) {
      const revNums = ds.rows.map((r) => r[revenueCol]).filter((v) => !isMissing(v ?? "")).map(toNumber).filter((n) => !isNaN(n));
      const totalRev = revNums.reduce((a, b) => a + b, 0);
      if (totalRev !== 0) {
        kpis.push({ label: "Profit Margin", value: `${((total / totalRev) * 100).toFixed(1)}%` });
      }
    }
  }

  if (quantityCol) {
    const nums = ds.rows.map((r) => r[quantityCol]).filter((v) => !isMissing(v ?? "")).map(toNumber).filter((n) => !isNaN(n));
    const total = nums.reduce((a, b) => a + b, 0);
    kpis.push({ label: "Total Units", value: fmtNum(total), sub: quantityCol });
  }

  return kpis;
}

// ---------- Insights ----------

export interface Insight {
  category: string;
  text: string;
  severity: "info" | "positive" | "warning";
}

export function generateInsights(ds: Dataset, profile: ProfileResult, stats: NumericStats[], corr: { pairs: CorrelationPair[] }): Insight[] {
  const insights: Insight[] = [];

  // quality-based
  if (profile.qualityScore >= 85) {
    insights.push({ category: "Data Quality", text: `Data quality score of ${profile.qualityScore}/100 — this dataset is largely analysis-ready.`, severity: "positive" });
  } else if (profile.qualityScore < 60) {
    insights.push({ category: "Data Quality", text: `Data quality score of ${profile.qualityScore}/100 indicates significant cleaning is required before this data should drive decisions.`, severity: "warning" });
  }

  if (profile.duplicateRowCount > 0) {
    const pct = ((profile.duplicateRowCount / profile.rowCount) * 100).toFixed(1);
    insights.push({
      category: "Duplicates",
      text: `${profile.duplicateRowCount} duplicate rows (${pct}% of the dataset) were found — any totals computed before deduplication will be inflated.`,
      severity: "warning",
    });
  }

  // categorical distribution insights
  profile.columns
    .filter((c) => c.type === "categorical")
    .forEach((c) => {
      const freq = new Map<string, number>();
      ds.rows.forEach((r) => {
        const v = (r[c.name] ?? "").trim();
        if (v) freq.set(v, (freq.get(v) ?? 0) + 1);
      });
      const sorted = [...freq.entries()].sort((a, b) => b[1] - a[1]);
      if (sorted.length > 0 && sorted.length <= 30) {
        const [topLabel, topCount] = sorted[0];
        const share = (topCount / ds.rows.length) * 100;
        if (share > 40) {
          insights.push({
            category: c.name,
            text: `"${topLabel}" accounts for ${share.toFixed(1)}% of all rows in "${c.name}" — a heavy concentration worth investigating for bias or a genuinely dominant segment.`,
            severity: "info",
          });
        }
      }
    });

  // numeric stats insights
  stats.forEach((s) => {
    if (Math.abs(s.skewness) > 1) {
      insights.push({
        category: s.column,
        text: `"${s.column}" is ${s.skewness > 0 ? "right" : "left"}-skewed (skewness ${s.skewness.toFixed(2)}) — the mean (${fmtNum(s.mean)}) is being pulled away from the median (${fmtNum(s.median)}) by extreme values. Consider reporting the median for a more representative "typical" figure.`,
        severity: "info",
      });
    }
    const iqr = s.q3 - s.q1;
    const lower = s.q1 - 1.5 * iqr;
    const upper = s.q3 + 1.5 * iqr;
    if (s.max > upper * 3 && s.max > 0) {
      const ratio = s.mean !== 0 ? s.max / s.mean : 0;
      insights.push({
        category: s.column,
        text: `The maximum value in "${s.column}" (${fmtNum(s.max)}) is roughly ${ratio.toFixed(1)}× the column average — worth checking whether this reflects genuine high-value records or a data entry error.`,
        severity: "warning",
      });
    }
  });

  // correlation insights
  corr.pairs.slice(0, 4).forEach((p) => {
    insights.push({
      category: "Correlation",
      text: `${p.strength[0].toUpperCase()}${p.strength.slice(1)} ${p.direction} relationship between "${p.colA}" and "${p.colB}" (r = ${p.r.toFixed(2)}). ${
        p.direction === "positive"
          ? `As "${p.colA}" increases, "${p.colB}" tends to increase alongside it.`
          : `As "${p.colA}" increases, "${p.colB}" tends to decrease.`
      }`,
      severity: "info",
    });
  });

  return insights;
}

export function buildExecutiveSummary(profile: ProfileResult, kpis: KPI[], insights: Insight[]): string {
  const parts: string[] = [];

  parts.push(
    `This dataset contains ${profile.rowCount.toLocaleString()} records across ${profile.colCount} columns, with a data quality score of ${profile.qualityScore}/100.`
  );

  if (profile.duplicateRowCount > 0) {
    parts.push(`${profile.duplicateRowCount} duplicate rows were identified and should be removed before this data is used for reporting.`);
  }

  const revenueKpi = kpis.find((k) => k.label === "Total Revenue");
  const growthKpi = kpis.find((k) => k.label.startsWith("Revenue Growth"));
  if (revenueKpi) {
    let s = `Total revenue across the dataset is ${revenueKpi.value}.`;
    if (growthKpi) s += ` Revenue moved ${growthKpi.value} from the first to the last recorded month.`;
    parts.push(s);
  }

  const retentionKpi = kpis.find((k) => k.label === "Returning Customer Rate");
  if (retentionKpi) {
    parts.push(`${retentionKpi.value} of customers appear more than once in the data, indicating a ${parseFloat(retentionKpi.value) > 30 ? "healthy" : "relatively low"} repeat-purchase pattern.`);
  }

  const warningInsights = insights.filter((i) => i.severity === "warning").slice(0, 2);
  if (warningInsights.length > 0) {
    parts.push(`Key risks to validate: ${warningInsights.map((i) => i.text).join(" ")}`);
  }

  const topCorrelation = insights.find((i) => i.category === "Correlation");
  if (topCorrelation) {
    parts.push(topCorrelation.text);
  }

  return parts.join(" ");
}
