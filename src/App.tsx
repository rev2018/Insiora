import { useMemo, useState } from "react";
import Papa from "papaparse";
import Header from "./components/Header";
import UploadZone from "./components/UploadZone";
import DataQualitySection from "./components/DataQualitySection";
import CleaningSection from "./components/CleaningSection";
import KpiSection from "./components/KpiSection";
import ChartsSection from "./components/ChartsSection";
import InsightsSection from "./components/InsightsSection";
import ExecutiveSummarySection from "./components/ExecutiveSummarySection";
import {
  Dataset,
  profileDataset,
  buildCleaningSuggestions,
  applyCleaning,
  computeNumericStats,
  computeCorrelations,
  detectKPIs,
  generateInsights,
  buildExecutiveSummary,
} from "./lib/analysis";

export default function App() {
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [cleanedDataset, setCleanedDataset] = useState<Dataset | null>(null);
  const [applied, setApplied] = useState(false);

  const handleFile = (file: File) => {
    setError(null);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const headers = results.meta.fields ?? [];
        if (headers.length === 0) {
          setError("Couldn't detect any columns in this file — make sure it's a valid CSV with a header row.");
          return;
        }
        const rows = results.data.filter((r) => Object.values(r).some((v) => v && v.trim() !== ""));
        if (rows.length === 0) {
          setError("This file parsed but contains no data rows.");
          return;
        }
        setDataset({ headers, rows });
        setCleanedDataset(null);
        setApplied(false);
        setChoices({});
        setFileName(file.name);
      },
      error: (err) => setError(`Couldn't parse this file: ${err.message}`),
    });
  };

  const activeDataset = cleanedDataset ?? dataset;

  const profile = useMemo(() => (activeDataset ? profileDataset(activeDataset) : null), [activeDataset]);
  const rawProfile = useMemo(() => (dataset ? profileDataset(dataset) : null), [dataset]);
  const suggestions = useMemo(() => (rawProfile ? buildCleaningSuggestions(rawProfile) : []), [rawProfile]);

  const stats = useMemo(() => (activeDataset && profile ? computeNumericStats(activeDataset, profile) : []), [activeDataset, profile]);
  const corr = useMemo(() => (activeDataset && profile ? computeCorrelations(activeDataset, profile) : { matrix: [], values: [], pairs: [] }), [
    activeDataset,
    profile,
  ]);
  const kpis = useMemo(() => (activeDataset && profile ? detectKPIs(activeDataset, profile) : []), [activeDataset, profile]);
  const insights = useMemo(
    () => (activeDataset && profile ? generateInsights(activeDataset, profile, stats, corr) : []),
    [activeDataset, profile, stats, corr]
  );
  const summary = useMemo(() => (profile ? buildExecutiveSummary(profile, kpis, insights) : ""), [profile, kpis, insights]);

  const handleApply = () => {
    if (!dataset || !rawProfile) return;
    // Merge in default option IDs for any suggestion the user never explicitly clicked —
    // the UI displays the default as "selected", so it must behave as selected here too.
    const mergedChoices: Record<string, string> = { ...choices };
    suggestions.forEach((s) => {
      const key = `${s.column}__${s.issue}`;
      if (!(key in mergedChoices)) mergedChoices[key] = s.defaultOptionId;
    });
    setChoices(mergedChoices);
    const cleaned = applyCleaning(dataset, rawProfile, mergedChoices);
    setCleanedDataset(cleaned);
    setApplied(true);
  };

  const reset = () => {
    setDataset(null);
    setCleanedDataset(null);
    setFileName("");
    setChoices({});
    setApplied(false);
    setError(null);
  };

  return (
    <div className="min-h-screen">
      <Header loaded={!!dataset} fileName={fileName} qualityScore={profile?.qualityScore} onReset={reset} />

      {!dataset ? (
        <UploadZone onFile={handleFile} error={error} />
      ) : (
        profile && (
          <>
            <DataQualitySection profile={applied && profile ? profile : rawProfile ?? profile} isCleanedView={applied} />
            <CleaningSection
              suggestions={suggestions}
              choices={choices}
              onChoice={(key, id) => setChoices((c) => ({ ...c, [key]: id }))}
              onApply={handleApply}
              applied={applied}
              cleanedDataset={cleanedDataset}
              fileName={fileName}
              beforeAfter={
                applied && dataset && cleanedDataset
                  ? {
                      beforeRows: dataset.rows.length,
                      afterRows: cleanedDataset.rows.length,
                      beforeCols: dataset.headers.length,
                      afterCols: cleanedDataset.headers.length,
                    }
                  : null
              }
            />
            <KpiSection kpis={kpis} />
            <ChartsSection ds={activeDataset!} profile={profile} stats={stats} />
            <InsightsSection
              correlationCols={corr.matrix.map((m) => m[0])}
              correlationValues={corr.values}
              pairs={corr.pairs}
              insights={insights}
            />
            <ExecutiveSummarySection summary={summary} profile={profile} kpis={kpis} fileName={fileName} />
          </>
        )
      )}
    </div>
  );
}
