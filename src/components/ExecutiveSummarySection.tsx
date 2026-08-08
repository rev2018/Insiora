import { ProfileResult, KPI } from "../lib/analysis";

interface Props {
  summary: string;
  profile: ProfileResult;
  kpis: KPI[];
  fileName: string;
}

export default function ExecutiveSummarySection({ summary, fileName }: Props) {
  return (
    <section id="summary" className="max-w-5xl mx-auto px-6 md:px-16 py-20 border-t border-line">
      <div className="mb-8">
        <div className="eyebrow">07 — Executive Summary</div>
      </div>

      <div className="panel p-8 md:p-12 max-w-3xl">
        <div className="eyebrow mb-4">{fileName}</div>
        <p className="font-display text-lg leading-relaxed">{summary}</p>
      </div>

      <p className="text-[12px] text-muted mt-6 max-w-lg">
        This summary is generated entirely from the computed statistics above — every number in it
        traces back to the profile, KPI, and correlation results on this page. Nothing here is
        model-generated speculation.
      </p>
    </section>
  );
}
