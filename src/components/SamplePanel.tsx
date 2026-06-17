import { useEffect, useState } from "react";
import { Pause, Play, Upload } from "lucide-react";
import { LeafIcon } from "./LeafIcon";
import { Section } from "./Section";
import { CollapsedStrip } from "./CollapsedStrip";
import { cn } from "../lib/cn";
import {
  publishFileMetadata,
  readAudioBytes,
  uploadToNip96,
  type ScanRow,
  type Verdict,
} from "../lib/tauri";
import { sampleDestPath } from "../lib/paths";

const SAMPLE_SECS = 10;
type Kind = "sample" | "full";
type Phase = "idle" | "uploading" | "publishing";

const VERDICT_COLOR: Record<Verdict, string> = {
  LOSSLESS: "text-ok",
  "PROBABLY-LOSSY": "text-alert",
  UNCERTAIN: "text-warn",
  LOSSY: "text-mauve",
  UNKNOWN: "text-muted",
};

interface SamplePanelProps {
  /** The track selected in the Library, or null when nothing is selected. */
  row: ScanRow | null;
  libRoot: string;
  workspaceDest: string;
  relays: string[];
  identityNpub: string | null;
  /** Whether a 10s clip already exists on disk for the selected row. */
  hasClip: boolean;
  /** Whether the selected row's clip is the one currently playing. */
  isPlaying: boolean;
  /** Toggle play/stop of the selected row's clip (App owns the audio element). */
  onPlay: () => void;
  onStatus: (s: { text: string; tone: "muted" | "warn" | "ok" | "alert" }) => void;
  /** Horizontal collapse — renders a thin strip and frees width for the Library. */
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

// The left flank — mirrors ndisc.smpl's InfoPanel. Shows the selected track's
// detail, a clip preview, and (folded in from the old modal) the publish form.
export function SamplePanel({
  row,
  libRoot,
  workspaceDest,
  relays,
  identityNpub,
  hasClip,
  isPlaying,
  onPlay,
  onStatus,
  collapsed,
  onToggleCollapsed,
}: SamplePanelProps) {
  const norm = libRoot.replace(/\/+$/, "");
  const rel = row ? row.path.replace(norm + "/", "") : "";
  const name = row ? row.path.split("/").pop() ?? row.path : "";

  const [kind, setKind] = useState<Kind>("sample");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [err, setErr] = useState<string | null>(null);

  // Reset the publish form whenever the selection changes — default the title
  // to the rel path with separators turned into em-dashes (matches the old
  // dialog), drop any half-typed description, clear errors.
  useEffect(() => {
    setKind("sample");
    setTitle(rel.replace(/\.[^.]+$/, "").replace(/\//g, " — "));
    setDescription("");
    setErr(null);
    setPhase("idle");
  }, [row?.path]);

  if (collapsed) {
    return (
      <CollapsedStrip
        label="Sample"
        icon={<LeafIcon size={16} className="rotate-[10deg]" />}
        side="left"
        onExpand={onToggleCollapsed}
        className="border-accent/30"
      />
    );
  }

  const busy = phase !== "idle";
  // A "sample" publish needs the 10s clip on disk; "full" uploads the same
  // clip but tags it differently (preserved from the dialog's behaviour).
  const canPublish =
    !!row && !!identityNpub && !!title.trim() && (kind === "full" || hasClip);

  async function handlePublish() {
    if (!row) return;
    setErr(null);
    if (!identityNpub) {
      setErr("Load or generate a Nostr key first (Publish · Nostr panel).");
      return;
    }
    const clipPath = sampleDestPath(row.path, libRoot, workspaceDest, SAMPLE_SECS);
    try {
      setPhase("uploading");
      onStatus({ text: `uploading ${title} to nostr.build…`, tone: "warn" });
      const bytes = await readAudioBytes(clipPath);
      const filename = clipPath.split("/").pop() ?? "sample.10s.flac";
      const upload = await uploadToNip96(bytes, filename, "audio/flac");

      setPhase("publishing");
      onStatus({ text: `publishing kind:1063 (${kind})…`, tone: "warn" });
      const res = await publishFileMetadata({
        url: upload.url,
        sha256: upload.hash,
        size: upload.size,
        mime: upload.mime,
        title,
        description,
        tTag: kind,
        relays,
      });
      onStatus({
        text: `published ${kind} · ${res.acceptedBy.length}/${relays.length} relays accepted`,
        tone: res.rejected.length > 0 ? "warn" : "ok",
      });
      setPhase("idle");
    } catch (e) {
      setErr(String(e));
      setPhase("idle");
    }
  }

  return (
    <Section
      title="Sample"
      icon={<LeafIcon size={16} className="rotate-[10deg]" />}
      onTitleClick={onToggleCollapsed}
      className="border-accent/30 w-[300px] shrink-0 min-h-0"
      contentClassName="flex-1 min-h-0 overflow-auto flex flex-col gap-3"
    >
      {!row ? (
        <p className="text-xs text-muted">Select a track in the Library.</p>
      ) : (
        <>
          <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-xs">
            <dt className="text-muted text-[10px] uppercase tracking-wide">name</dt>
            <dd className="font-mono truncate" title={name}>{name}</dd>
            <dt className="text-muted text-[10px] uppercase tracking-wide">source</dt>
            <dd className="font-mono truncate" title={rel}>{rel}</dd>
            <dt className="text-muted text-[10px] uppercase tracking-wide">verdict</dt>
            <dd className={cn("font-mono", VERDICT_COLOR[row.verdict])}>{row.verdict}</dd>
            <dt className="text-muted text-[10px] uppercase tracking-wide">peak</dt>
            <dd className="font-mono text-fg/90">
              {row.peak !== null ? `${row.peak >= 0 ? "+" : ""}${row.peak.toFixed(1)} dB` : "—"}
            </dd>
            <dt className="text-muted text-[10px] uppercase tracking-wide">rate</dt>
            <dd className="font-mono text-fg/90">
              {row.sr ? `${row.sr.toLocaleString()} Hz` : "—"}
            </dd>
          </dl>

          {/* Clip status + preview — a leaf you've plucked from the tree. */}
          <div className="flex items-center gap-2 text-xs">
            <LeafIcon
              size={14}
              className={cn("rotate-[10deg]", hasClip ? "text-ok" : "text-muted/50")}
            />
            {hasClip ? (
              <button
                type="button"
                onClick={onPlay}
                className={cn(
                  "inline-flex items-center gap-1.5 px-2 py-1 rounded-md",
                  "bg-surface hover:bg-surfaceHover transition-colors",
                  isPlaying ? "text-mauve" : "text-ok",
                )}
                title={isPlaying ? "Stop preview" : `Preview ${SAMPLE_SECS}s clip`}
              >
                {isPlaying ? <Pause size={12} /> : <Play size={12} />}
                <span>{isPlaying ? "playing…" : `preview ${SAMPLE_SECS}s clip`}</span>
              </button>
            ) : (
              <span className="text-muted">no clip — sample it from the Library first</span>
            )}
          </div>

          {/* Publish — folded in from the old modal dialog. */}
          <div className="flex flex-col gap-2 border-t border-surface/50 pt-3">
            <div className="text-[10px] uppercase tracking-wide text-muted">Publish to Nostr</div>
            <div className="flex gap-2">
              {(["sample", "full"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  disabled={busy}
                  onClick={() => setKind(k)}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-xs flex-1",
                    k === kind
                      ? "bg-accent text-bg font-semibold"
                      : "bg-surface text-fg/80 hover:bg-surfaceHover",
                    busy && "opacity-50 cursor-not-allowed",
                  )}
                >
                  {k === "sample" ? `Sample (${SAMPLE_SECS}s)` : "Full track"}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={busy}
              placeholder="Title"
              className="w-full px-2.5 py-1.5 rounded-md bg-surface text-fg text-xs
                         outline-none border border-transparent
                         focus:border-accent/50 disabled:opacity-50"
              spellCheck={false}
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={busy}
              rows={2}
              placeholder="Description (optional)"
              className="w-full px-2.5 py-1.5 rounded-md bg-surface text-fg text-xs
                         outline-none border border-transparent
                         focus:border-accent/50 disabled:opacity-50 resize-none
                         placeholder:text-muted/60"
              spellCheck={false}
            />
            {err && <p className="text-[11px] text-alert font-mono break-all">{err}</p>}
            <button
              onClick={handlePublish}
              disabled={busy || !canPublish}
              title={
                !identityNpub
                  ? "Sign in to publish (Publish · Nostr panel)"
                  : kind === "sample" && !hasClip
                    ? "No clip on disk — sample this track first"
                    : "Publish to Nostr (kind:1063)"
              }
              className={cn(
                "px-3 py-1.5 rounded-md font-semibold text-xs flex items-center justify-center gap-1.5",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "bg-accent text-bg hover:opacity-90",
              )}
            >
              <Upload size={12} />
              {phase === "uploading"
                ? "uploading…"
                : phase === "publishing"
                  ? "publishing…"
                  : "Publish"}
            </button>
          </div>
        </>
      )}
    </Section>
  );
}
