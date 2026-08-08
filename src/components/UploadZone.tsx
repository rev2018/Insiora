import { useCallback, useRef, useState } from "react";
import { motion } from "framer-motion";

interface Props {
  onFile: (file: File) => void;
  error: string | null;
}

const SAMPLE_CSV = `order_id,customer_id,category,region,units,price,order_date
1001,C-204,Electronics,North,3,129.99,2025-01-04
1002,C-118,Apparel,South,1,45.00,2025-01-06
1003,C-204,Electronics,North,2,89.50,2025-01-09
1004,C-330, apparel ,West,5,22.00,2025-01-11
1005,C-118,Home,South,1,150.00,2025-01-14
1006,C-441,Electronics,East,1,-40.00,2025-01-18
1007,C-330,Apparel,West,2,22.00,2025-01-19
1008,C-118,Home,South,1,150.00,2025-01-14
1009,C-559,Electronics,North,12,129.99,2025-02-02
1010,C-204,Electronics,North,,129.99,2025-02-05`;

export default function UploadZone({ onFile, error }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (files && files[0]) onFile(files[0]);
    },
    [onFile]
  );

  const loadSample = () => {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv" });
    const file = new File([blob], "sample-orders.csv", { type: "text/csv" });
    onFile(file);
  };

  return (
    <section className="min-h-screen flex flex-col justify-center px-6 md:px-16 py-24 max-w-5xl mx-auto">
      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="eyebrow mb-6"
      >
        Insiora — Data Quality &amp; BI Diagnostic
      </motion.p>

      <motion.h1
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.05 }}
        className="font-display text-[2.6rem] md:text-6xl leading-[1.05] max-w-3xl"
      >
        Upload a CSV.
        <br />
        Get the <em className="italic text-signal">audit</em>, not just the chart.
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.12 }}
        className="mt-6 max-w-xl text-muted text-[15px] leading-relaxed"
      >
        Insiora profiles your dataset, scores its quality, recommends specific fixes, detects KPIs,
        runs the statistics, and writes the executive summary — entirely in your browser. Nothing
        is uploaded to a server.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className={`mt-10 panel p-10 md:p-14 transition-colors ${
          dragOver ? "border-signal bg-signal-soft/40" : ""
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
      >
        <div className="flex flex-col items-start gap-4">
          <div className="eyebrow">01 — Load a dataset</div>
          <p className="text-sm text-muted max-w-md">
            Drop a .csv file here, or choose one from your computer. Files stay local — this runs
            entirely client-side.
          </p>
          <div className="flex flex-wrap gap-3 mt-2">
            <button className="btn-primary" onClick={() => inputRef.current?.click()}>
              Choose CSV file
            </button>
            <button className="btn-ghost" onClick={loadSample}>
              Try a sample dataset
            </button>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>
        {error && (
          <p className="mt-6 text-sm text-alert font-mono border-t border-line pt-4">{error}</p>
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.35 }}
        className="mt-14 grid grid-cols-2 md:grid-cols-4 gap-8 text-sm"
      >
        {[
          ["01", "Profile & score", "Row/column stats, missingness, a weighted 0–100 quality score."],
          ["02", "Clean, your call", "Every fix is a recommendation you accept or skip — nothing silently changes."],
          ["03", "Stats & KPIs", "Descriptive statistics, correlation, outliers, auto-detected business KPIs."],
          ["04", "Executive summary", "A written brief generated from the actual numbers — export as PDF."],
        ].map(([n, title, desc]) => (
          <div key={n} className="border-t border-line pt-3">
            <div className="font-mono text-xs text-muted">{n}</div>
            <div className="font-display text-base mt-1">{title}</div>
            <div className="text-muted text-[13px] mt-1 leading-snug">{desc}</div>
          </div>
        ))}
      </motion.div>
    </section>
  );
}
