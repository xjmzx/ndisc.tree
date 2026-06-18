import { LineChart } from "lucide-react";
import { Section } from "./Section";
import { cn } from "../lib/cn";
import type { Verdict } from "../lib/tauri";

// The five scan verdicts, in bar order, with their suite colours (matching the
// header verdict bar + LibraryTree). Lossless ← ok green; Probably-lossy ←
// alert; Uncertain ← warn; Lossy ← mauve; Unknown ← muted.
const VERDICT_META: { key: Verdict; label: string; bar: string; text: string }[] = [
  { key: "LOSSLESS", label: "Lossless", bar: "bg-ok", text: "text-ok" },
  { key: "PROBABLY-LOSSY", label: "Probably lossy", bar: "bg-alert", text: "text-alert" },
  { key: "UNCERTAIN", label: "Uncertain", bar: "bg-warn", text: "text-warn" },
  { key: "LOSSY", label: "Lossy", bar: "bg-mauve", text: "text-mauve" },
  { key: "UNKNOWN", label: "Unknown", bar: "bg-muted", text: "text-muted" },
];

interface StatsViewProps {
  counts: Record<Verdict, number>;
}

// Placeholder stats page — the lossy-vs-lossless picture from the scan's
// spectral verdicts. Borrows ndisc's StatsView chrome (Section cards, digital
// tone). More breakdowns (by artist, over time, vs format label) to come.
export function StatsView({ counts }: StatsViewProps) {
  const total = VERDICT_META.reduce((s, v) => s + counts[v.key], 0);
  const pct = (n: number) => (total ? (100 * n) / total : 0);
  const fmtPct = (n: number) => `${pct(n).toFixed(pct(n) < 10 ? 1 : 0)}%`;

  // Headline lossless / lossy / uncertain rollup. Probably-lossy folds into
  // lossy (a "lossless" file that's actually a transcode); uncertain + unknown
  // are the can't-tell bucket.
  const lossless = counts.LOSSLESS;
  const lossy = counts.LOSSY + counts["PROBABLY-LOSSY"];
  const unsure = counts.UNCERTAIN + counts.UNKNOWN;

  return (
    <div className="flex-1 min-h-0 overflow-auto flex flex-col gap-4">
      <Section
        title="Library quality"
        icon={<LineChart size={16} />}
        className="border-digital/30"
        contentClassName="flex flex-col gap-4"
      >
        {total === 0 ? (
          <p className="text-xs text-muted">
            No scan data yet — run a scan to see the lossy / lossless breakdown.
          </p>
        ) : (
          <>
            {/* Headline rollup — lossless vs lossy vs uncertain. */}
            <div className="grid grid-cols-3 gap-3">
              <Headline label="Lossless" n={lossless} pct={fmtPct(lossless)} cls="text-ok" />
              <Headline label="Lossy" n={lossy} pct={fmtPct(lossy)} cls="text-mauve" />
              <Headline label="Uncertain" n={unsure} pct={fmtPct(unsure)} cls="text-warn" />
            </div>

            {/* Full five-verdict stacked bar. */}
            <div className="h-3 rounded-sm overflow-hidden bg-bg/60 flex">
              {VERDICT_META.map((v) =>
                counts[v.key] > 0 ? (
                  <div
                    key={v.key}
                    className={cn("h-full", v.bar)}
                    style={{ width: `${pct(counts[v.key])}%` }}
                    title={`${v.label} ${counts[v.key].toLocaleString()}`}
                  />
                ) : null,
              )}
            </div>

            {/* Legend with exact counts + percentages. */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1.5 text-xs">
              {VERDICT_META.map((v) => (
                <div key={v.key} className="flex items-center gap-2">
                  <span className={cn("w-2.5 h-2.5 rounded-sm shrink-0", v.bar)} />
                  <span className="flex-1 text-fg/80">{v.label}</span>
                  <span className="font-mono tabular-nums text-fg/90">
                    {counts[v.key].toLocaleString()}
                  </span>
                  <span className="font-mono tabular-nums text-muted w-12 text-right">
                    {fmtPct(counts[v.key])}
                  </span>
                </div>
              ))}
              <div className="flex items-center gap-2 sm:col-span-2 border-t border-surface/50 pt-1.5 mt-0.5">
                <span className="w-2.5 h-2.5 shrink-0" />
                <span className="flex-1 text-muted uppercase tracking-wide text-[10px]">
                  total tracks scanned
                </span>
                <span className="font-mono tabular-nums text-fg/90">
                  {total.toLocaleString()}
                </span>
                <span className="w-12" />
              </div>
            </div>
          </>
        )}
      </Section>

      <p className="text-[11px] text-muted/70 px-1 leading-relaxed">
        Placeholder. These verdicts come from spectral analysis of the actual
        audio — a deeper read than the format-label lossless/lossy that ndisc
        and glmps infer from the codec name, so a “FLAC” that’s really a
        transcode lands in “probably lossy” here. More breakdowns to come.
      </p>
    </div>
  );
}

function Headline({
  label,
  n,
  pct,
  cls,
}: {
  label: string;
  n: number;
  pct: string;
  cls: string;
}) {
  return (
    <div className="rounded-lg bg-bg/40 px-3 py-2 flex flex-col gap-0.5">
      <span className={cn("text-2xl font-bold tabular-nums leading-none", cls)}>
        {n.toLocaleString()}
      </span>
      <span className="text-[10px] uppercase tracking-wide text-muted">
        {label} · {pct}
      </span>
    </div>
  );
}
