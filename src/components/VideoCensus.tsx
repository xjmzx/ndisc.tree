import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { cn } from "../lib/cn";
import { classifyVideos, type VideoBucket, type VideoRow } from "../lib/tauri";

// Part A of the Normalize-videos plan: a read-only census of the library's
// video files, bucketed by what they'd need to become playable mp4 (h264/aac
// faststart). Nothing is modified here — this is "see what you have first".

const BUCKET: Record<
  VideoBucket,
  { label: string; text: string; dot: string; note: string }
> = {
  plays: {
    label: "plays as-is",
    text: "text-ok",
    dot: "bg-ok",
    note: "h264 + aac, mp4/m4v, faststart",
  },
  remux: {
    label: "remux",
    text: "text-digital",
    dot: "bg-digital",
    note: "h264 + playable audio — repackage to faststart mp4 (-c copy)",
  },
  audioFix: {
    label: "audio fix",
    text: "text-warn",
    dot: "bg-warn",
    note: "h264, but the audio needs re-encoding to aac (-c:v copy)",
  },
  transcode: {
    label: "transcode",
    text: "text-mauve",
    dot: "bg-mauve",
    note: "legacy video codec — full libx264/aac encode",
  },
  unknown: {
    label: "unknown",
    text: "text-muted",
    dot: "bg-muted",
    note: "ffprobe failed / no video stream",
  },
};

const ORDER: VideoBucket[] = ["plays", "remux", "audioFix", "transcode", "unknown"];

const GRID =
  "grid-cols-[minmax(0,2fr)_5rem_5rem_3.5rem_3.5rem_6.5rem]";

function relpath(path: string, root: string) {
  if (root && path.startsWith(root)) return path.slice(root.length).replace(/^\/+/, "");
  return path;
}

export function VideoCensus({ root }: { root: string }) {
  const [rows, setRows] = useState<VideoRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!root) return;
    setLoading(true);
    setError(null);
    classifyVideos(root)
      .then(setRows)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [root]);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(() => {
    const c: Record<VideoBucket, number> = {
      plays: 0,
      remux: 0,
      audioFix: 0,
      transcode: 0,
      unknown: 0,
    };
    for (const r of rows ?? []) c[r.bucket]++;
    return c;
  }, [rows]);

  const needsWork = rows
    ? rows.length - counts.plays
    : 0;

  return (
    <div className="rounded-xl bg-panel border border-surface/60 shadow-md flex flex-col min-h-0 h-full overflow-hidden">
      {/* Toolbar: title · per-bucket summary · refresh */}
      <div className="flex items-center gap-3 px-4 py-2 shrink-0 border-b border-surface/60 text-xs">
        <span className="text-accent font-medium uppercase tracking-wide shrink-0">
          Video types
        </span>
        {rows && (
          <span className="text-muted shrink-0">
            {rows.length} files · {needsWork} need work
          </span>
        )}
        <div className="flex items-center gap-3 ml-auto">
          {ORDER.map((b) =>
            counts[b] > 0 ? (
              <span
                key={b}
                className="inline-flex items-center gap-1.5"
                title={BUCKET[b].note}
              >
                <span className={cn("w-2 h-2 rounded-full", BUCKET[b].dot)} />
                <span className={BUCKET[b].text}>
                  {counts[b]} {BUCKET[b].label}
                </span>
              </span>
            ) : null,
          )}
          <button
            type="button"
            onClick={load}
            disabled={loading}
            title="Re-probe videos"
            aria-label="Refresh"
            className="p-1 rounded text-muted hover:text-fg hover:bg-surface/40 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <RefreshCw size={13} />
            )}
          </button>
        </div>
      </div>

      {/* Column header */}
      <div
        className={cn(
          "grid items-center gap-3 px-4 py-2 shrink-0 border-b border-surface/60",
          "bg-panel text-xs uppercase tracking-wide text-accent font-medium",
          GRID,
        )}
      >
        <span>file</span>
        <span>video</span>
        <span>audio</span>
        <span>cont</span>
        <span>fast</span>
        <span>action</span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto [scrollbar-gutter:stable]">
        {error ? (
          <div className="px-4 py-6 text-sm text-alert">{error}</div>
        ) : loading && !rows ? (
          <div className="px-4 py-6 text-sm text-muted flex items-center gap-2">
            <Loader2 size={14} className="animate-spin" /> probing videos…
          </div>
        ) : rows && rows.length === 0 ? (
          <div className="px-4 py-6 text-sm text-muted">
            No video files under the library root.
          </div>
        ) : (
          (rows ?? []).map((r) => {
            const meta = BUCKET[r.bucket];
            return (
              <div
                key={r.path}
                title={meta.note}
                className={cn(
                  "grid items-center gap-3 px-4 py-1 font-mono text-xs",
                  "border-b border-fg/15 hover:bg-surface/30 transition-colors",
                  GRID,
                )}
              >
                <span className="truncate text-fg/85" title={r.path}>
                  {relpath(r.path, root)}
                </span>
                <span className="truncate text-fg/70">{r.vcodec ?? "—"}</span>
                <span className="truncate text-fg/70">{r.acodec ?? "—"}</span>
                <span className="text-fg/60">{r.container}</span>
                <span className={r.faststart ? "text-ok" : "text-muted/40"}>
                  {r.faststart ? "✓" : "—"}
                </span>
                <span className={cn("inline-flex items-center gap-1.5", meta.text)}>
                  <span className={cn("w-2 h-2 rounded-full shrink-0", meta.dot)} />
                  <span className="truncate">{meta.label}</span>
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
