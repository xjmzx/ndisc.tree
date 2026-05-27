import { useEffect, useState } from "react";
import { Upload, X } from "lucide-react";
import { cn } from "../lib/cn";
import {
  publishFileMetadata,
  readAudioBytes,
  uploadToNip96,
  type ScanRow,
} from "../lib/tauri";
import { sampleDestPath } from "../lib/paths";

const SAMPLE_SECS = 10;
type Kind = "sample" | "full";
type Phase = "idle" | "uploading" | "publishing";

interface PublishSampleDialogProps {
  row: ScanRow;
  libRoot: string;
  workspaceDest: string;
  relays: string[];
  identityNpub: string | null;
  onClose: () => void;
  onStatus: (s: { text: string; tone: "muted" | "warn" | "ok" | "alert" }) => void;
}

export function PublishSampleDialog({
  row,
  libRoot,
  workspaceDest,
  relays,
  identityNpub,
  onClose,
  onStatus,
}: PublishSampleDialogProps) {
  const defaultTitle = row.path
    .replace(libRoot.replace(/\/+$/, "") + "/", "")
    .replace(/\.[^.]+$/, "")
    .replace(/\//g, " — ");

  const [kind, setKind] = useState<Kind>("sample");
  const [title, setTitle] = useState(defaultTitle);
  const [description, setDescription] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [err, setErr] = useState<string | null>(null);

  // Esc closes when idle. While uploading/publishing, ignore so an
  // accidental key press doesn't abandon a half-completed flow.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && phase === "idle") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, phase]);

  async function handlePublish() {
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
      onClose();
    } catch (e) {
      setErr(String(e));
      setPhase("idle");
    }
  }

  const busy = phase !== "idle";

  return (
    <div
      className="fixed inset-0 z-50 bg-bg/80 flex items-center justify-center p-4"
      onClick={() => !busy && onClose()}
    >
      <div
        className="w-full max-w-md rounded-xl bg-panel border border-surface/60 shadow-xl
                   p-5 flex flex-col gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-2">
          <Upload size={16} className="text-accent shrink-0 mt-0.5" />
          <h2 className="text-sm tracking-wide uppercase text-accent font-semibold flex-1">
            Publish to Nostr
          </h2>
          <button
            onClick={onClose}
            disabled={busy}
            className="text-muted hover:text-fg disabled:opacity-30"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>

        <p className="text-xs text-muted font-mono break-all" title={row.path}>
          {row.path.replace(libRoot.replace(/\/+$/, "") + "/", "")}
        </p>

        <div className="space-y-1">
          <div className="text-[10px] uppercase tracking-wide text-muted">Kind</div>
          <div className="flex gap-2">
            {(["sample", "full"] as const).map((k) => (
              <button
                key={k}
                type="button"
                disabled={busy}
                onClick={() => setKind(k)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs flex-1",
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
        </div>

        <div className="space-y-1">
          <div className="text-[10px] uppercase tracking-wide text-muted">Title</div>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={busy}
            className="w-full px-2.5 py-1.5 rounded-md bg-surface text-fg text-xs
                       outline-none border border-transparent
                       focus:border-accent/50 disabled:opacity-50"
            spellCheck={false}
          />
        </div>

        <div className="space-y-1">
          <div className="text-[10px] uppercase tracking-wide text-muted">
            Description (optional)
          </div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={busy}
            rows={3}
            placeholder="Notes about this clip — context, source, anything else."
            className="w-full px-2.5 py-1.5 rounded-md bg-surface text-fg text-xs
                       outline-none border border-transparent
                       focus:border-accent/50 disabled:opacity-50 resize-none
                       placeholder:text-muted/60"
            spellCheck={false}
          />
        </div>

        {err && (
          <p className="text-[11px] text-alert font-mono break-all">{err}</p>
        )}

        <div className="flex gap-2 justify-end pt-1">
          <button
            onClick={onClose}
            disabled={busy}
            className="px-3 py-1.5 rounded-md bg-surface hover:bg-surfaceHover
                       text-fg text-xs disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handlePublish}
            disabled={busy || !title.trim() || !identityNpub}
            className={cn(
              "px-3 py-1.5 rounded-md font-semibold text-xs flex items-center gap-1.5",
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
      </div>
    </div>
  );
}
