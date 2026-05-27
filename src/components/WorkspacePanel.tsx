import { useEffect, useMemo, useState } from "react";
import { FolderOpen, FolderTree, Hammer, ShieldCheck } from "lucide-react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { Section } from "./Section";
import { cn } from "../lib/cn";
import { uniquePairs } from "../lib/paths";
import { createMirrorTree, type MirrorResult, type ScanRow } from "../lib/tauri";
import { usePersistedBool } from "../lib/usePersistedString";

const EXPANDED_KEY = "afqc-tauri.mirrortree.expanded";

type State =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "done"; result: MirrorResult }
  | { kind: "err"; message: string };

interface WorkspacePanelProps {
  rows: ScanRow[];
  libRoot: string;
  anyFilter: boolean;
  /** Shared workspace destination — also consumed by SamplerPanel. */
  dest: string;
  setDest: (v: string) => void;
  onStatus: (s: { text: string; tone: "muted" | "warn" | "ok" | "alert" }) => void;
  /**
   * Lifts the mirror state (running / done / err) up so the shared
   * OperationOutput strip can render the result or error. The in-panel
   * result + error blocks are gone — this is now the only surface.
   */
  onMirrorState?: (s: {
    kind: "idle" | "running" | "done" | "err";
    result?: MirrorResult;
    error?: string;
  }) => void;
}

export function WorkspacePanel({
  rows,
  libRoot,
  anyFilter,
  dest,
  setDest,
  onStatus,
  onMirrorState,
}: WorkspacePanelProps) {
  const [expanded, setExpanded] = usePersistedBool(EXPANDED_KEY, true);
  const [sudo, setSudo] = useState(false);
  const [state, setState] = useState<State>({ kind: "idle" });

  // Emit state changes up so the shared OperationOutput can render
  // running / result / error from outside the panel.
  useEffect(() => {
    if (!onMirrorState) return;
    if (state.kind === "done") onMirrorState({ kind: "done", result: state.result });
    else if (state.kind === "err") onMirrorState({ kind: "err", error: state.message });
    else onMirrorState({ kind: state.kind });
  }, [state, onMirrorState]);

  const pairs = useMemo(() => uniquePairs(rows, libRoot), [rows, libRoot]);
  const artistCount = useMemo(
    () => new Set(pairs.map((p) => p.artist)).size,
    [pairs],
  );

  async function browse() {
    const picked = await openDialog({
      directory: true,
      multiple: false,
      title: "Choose mirror destination",
      defaultPath: dest || undefined,
    });
    if (typeof picked === "string") setDest(picked);
  }

  async function createMirror() {
    const target = dest.trim();
    if (!target || pairs.length === 0) return;
    setState({ kind: "running" });
    onStatus({
      text: sudo
        ? `mirroring ${pairs.length} folders (pkexec — watch for password prompt)…`
        : `mirroring ${pairs.length} folders…`,
      tone: "warn",
    });
    try {
      const result = await createMirrorTree(target, libRoot, pairs, sudo);
      setState({ kind: "done", result });
      const suffix = sudo ? " · chown/chmod matched to source" : "";
      onStatus({
        text:
          `mirror complete · created ${result.created}, skipped ${result.skipped}` +
          (result.errors.length ? `, ${result.errors.length} errors` : "") +
          suffix,
        tone: result.errors.length ? "warn" : "ok",
      });
    } catch (e) {
      setState({ kind: "err", message: String(e) });
      onStatus({ text: `mirror failed: ${e}`, tone: "alert" });
    }
  }

  const running = state.kind === "running";
  const canRun = !!dest.trim() && pairs.length > 0 && !running;

  return (
    <Section
      title="Mirror tree"
      icon={<FolderTree size={16} />}
      onTitleClick={() => setExpanded(!expanded)}
    >
      {/* Pinned line — visible whether the panel is expanded or collapsed.
          Same counts that used to live in the secondary row below. */}
      <div className="text-xs text-fg/80">
        {pairs.length === 0 ? (
          <span className="text-muted">scan or clear the filter to mirror</span>
        ) : (
          <>
            <span className="font-semibold">{artistCount.toLocaleString()}</span>{" "}
            artist{artistCount === 1 ? "" : "s"}
            {" | "}
            <span className="font-semibold">{pairs.length.toLocaleString()}</span>{" "}
            release{pairs.length === 1 ? "" : "s"}
            {" | "}
            <span className="font-semibold">{rows.length.toLocaleString()}</span>{" "}
            {anyFilter ? "filtered " : ""}track{rows.length === 1 ? "" : "s"}
          </>
        )}
      </div>
      {expanded && (
        <>
          <div className="flex gap-2">
            <input
              type="text"
              value={dest}
              onChange={(e) => setDest(e.target.value)}
              placeholder="/path/to/workspace"
              disabled={running}
              className="flex-1 px-3 py-2 rounded-md bg-surface text-fg
                         placeholder:text-muted outline-none border border-transparent
                         focus:border-accent/50 disabled:opacity-50"
              spellCheck={false}
            />
            <button
              onClick={browse}
              disabled={running}
              className="px-3 py-2 rounded-md bg-surface hover:bg-surfaceHover
                         text-fg disabled:opacity-50 disabled:cursor-not-allowed
                         flex items-center justify-center"
              title="Browse for destination"
              aria-label="Browse for destination"
            >
              <FolderOpen size={14} />
            </button>
            <button
              onClick={createMirror}
              disabled={!canRun}
              className={cn(
                "px-3 py-2 rounded-md font-semibold",
                "flex items-center justify-center",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "bg-accent text-bg hover:opacity-90",
              )}
              title={
                running
                  ? "creating…"
                  : pairs.length === 0
                    ? "Scan or clear the filter first"
                    : !dest.trim()
                      ? "Choose a destination directory"
                      : `Create ${pairs.length} release folder${pairs.length === 1 ? "" : "s"} under ${dest}`
              }
              aria-label="Create mirror tree"
            >
              <Hammer size={14} className={running ? "animate-pulse" : ""} />
            </button>
          </div>

          <div className="flex items-center justify-end text-xs">
            <label
              className={cn(
                "flex items-center gap-1.5 cursor-pointer select-none",
                "px-2 py-0.5 rounded hover:bg-surface/30",
                running && "opacity-50 cursor-not-allowed",
              )}
              title="Run mkdir + chown + chmod through pkexec — one system password prompt for the batch. The destination tree's owner/group/mode will be set to match the source library root."
            >
              <input
                type="checkbox"
                checked={sudo}
                onChange={(e) => setSudo(e.target.checked)}
                disabled={running}
                className="accent-accent"
              />
              <ShieldCheck
                size={11}
                className={sudo ? "text-accent" : "text-muted"}
              />
              <span className={sudo ? "text-fg" : "text-muted"}>pkexec</span>
            </label>
          </div>

        </>
      )}
    </Section>
  );
}
