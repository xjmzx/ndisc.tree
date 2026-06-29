import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "../lib/cn";
import type { ScanReport, Verdict } from "../lib/tauri";

// Flat, sortable, read-only view of the scan — the hierarchically-flat
// counterpart to the Library tree (ndisc's BatchEditView skeleton, minus the
// inline-edit cells / publish toolbar: a scan row has no user-editable field,
// its verdict/peak/rate are computed). Dense mono rows, client-side sort.

const VERDICT_TEXT: Record<Verdict, string> = {
  LOSSLESS: "text-ok",
  "PROBABLY-LOSSY": "text-alert",
  UNCERTAIN: "text-warn",
  LOSSY: "text-mauve",
  UNKNOWN: "text-muted",
};

// Rendered-row cap so a huge library stays responsive without virtualization;
// the overflow is surfaced in the toolbar (never silently dropped). Sorting
// happens over the full set first, so the cap shows the top N for the sort.
const MAX_ROWS = 2000;

interface Flat {
  path: string;
  artist: string;
  release: string;
  file: string;
  verdict: Verdict;
  peak: number | null;
  sr: number | null;
  info: string;
}

type SortKey = keyof Omit<Flat, "path">;
type SortDir = "asc" | "desc";

interface Column {
  key: SortKey;
  label: string;
  numeric?: boolean;
}

const COLUMNS: Column[] = [
  { key: "artist", label: "artist" },
  { key: "release", label: "release" },
  { key: "file", label: "file" },
  { key: "verdict", label: "verdict" },
  { key: "peak", label: "peak dBFS", numeric: true },
  { key: "sr", label: "rate", numeric: true },
  { key: "info", label: "info" },
];

const GRID =
  "grid-cols-[minmax(0,1.1fr)_minmax(0,1.3fr)_minmax(0,1.6fr)_7rem_5rem_5rem_minmax(0,1fr)]";

// Split an absolute path into (artist, release, file) the same 2-deep way the
// Library tree groups: <root>/<artist>/<release>/<file>; a file directly under
// an artist folder has no release.
function relParts(path: string, root: string) {
  let rel = path;
  if (root && path.startsWith(root)) rel = path.slice(root.length).replace(/^\/+/, "");
  const segs = rel.split("/").filter(Boolean);
  return {
    artist: segs[0] ?? "",
    release: segs.length >= 3 ? segs[1] : "",
    file: segs.length ? segs[segs.length - 1] : path,
  };
}

function compare(a: Flat, b: Flat, key: SortKey, dir: SortDir, numeric: boolean) {
  const av = a[key];
  const bv = b[key];
  const aEmpty = av == null || av === "";
  const bEmpty = bv == null || bv === "";
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1; // blanks always sink, regardless of direction
  if (bEmpty) return -1;
  const r = numeric
    ? Number(av) - Number(bv)
    : String(av).localeCompare(String(bv), undefined, { sensitivity: "base" });
  return dir === "asc" ? r : -r;
}

export function TableView({ report }: { report: ScanReport | null }) {
  const [sortKey, setSortKey] = useState<SortKey>("artist");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const flat = useMemo<Flat[]>(() => {
    if (!report) return [];
    return report.rows.map((r) => ({
      path: r.path,
      ...relParts(r.path, report.root),
      verdict: r.verdict,
      peak: r.peak,
      sr: r.sr,
      info: r.info,
    }));
  }, [report]);

  const sorted = useMemo(() => {
    const numeric = !!COLUMNS.find((c) => c.key === sortKey)?.numeric;
    return [...flat].sort((a, b) => compare(a, b, sortKey, sortDir, numeric));
  }, [flat, sortKey, sortDir]);

  const shown = sorted.slice(0, MAX_ROWS);
  const overflow = sorted.length - shown.length;

  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  return (
    <div className="rounded-xl bg-panel border border-surface/60 shadow-md flex flex-col min-h-0 h-full overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-1.5 shrink-0 border-b border-surface/60 text-xs">
        <span className="text-muted">
          {report ? `${flat.length} files` : "no scan"}
          {overflow > 0 && (
            <span className="ml-3 text-warn">
              showing {MAX_ROWS} of {flat.length} (sorted) — refine or filter to
              narrow
            </span>
          )}
        </span>
      </div>

      <div
        className={cn(
          "grid items-center gap-3 px-4 py-2 shrink-0 border-b border-surface/60",
          "bg-panel sticky top-0 z-10 text-xs uppercase tracking-wide text-accent font-medium",
          GRID,
        )}
      >
        {COLUMNS.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => toggleSort(c.key)}
            className={cn(
              "inline-flex items-center gap-1 min-w-0 hover:text-fg transition-colors",
              c.numeric ? "justify-end" : "justify-start",
            )}
            title={`Sort by ${c.label}`}
          >
            <span className="truncate">{c.label}</span>
            {sortKey === c.key &&
              (sortDir === "asc" ? (
                <ArrowUp size={11} className="shrink-0" />
              ) : (
                <ArrowDown size={11} className="shrink-0" />
              ))}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto [scrollbar-gutter:stable]">
        {!report ? (
          <div className="px-4 py-6 text-sm text-muted">
            No scan data yet — run a scan.
          </div>
        ) : shown.length === 0 ? (
          <div className="px-4 py-6 text-sm text-muted">no files</div>
        ) : (
          shown.map((r) => (
            <div
              key={r.path}
              className={cn(
                "grid items-center gap-3 px-4 py-1 font-mono text-xs",
                "border-b border-fg/25 hover:bg-surface/30 transition-colors",
                GRID,
              )}
            >
              {COLUMNS.map((c) => {
                if (c.key === "verdict") {
                  return (
                    <span
                      key={c.key}
                      className={cn("truncate", VERDICT_TEXT[r.verdict])}
                      title={r.verdict}
                    >
                      {r.verdict}
                    </span>
                  );
                }
                const raw = r[c.key];
                const empty = raw == null || raw === "";
                const text =
                  c.key === "peak" && raw != null
                    ? Number(raw).toFixed(1)
                    : empty
                      ? "—"
                      : String(raw);
                return (
                  <span
                    key={c.key}
                    className={cn(
                      "truncate text-fg/85",
                      c.numeric && "text-right tabular-nums",
                      empty && "text-muted/40",
                    )}
                    title={empty ? undefined : String(raw)}
                  >
                    {text}
                  </span>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
