import { useState } from "react";
import { Check, Copy, KeyRound, Radio, Sparkles, Trash2 } from "lucide-react";
import { Section } from "./Section";
import { usePersistedBool } from "../lib/usePersistedString";
import {
  clearIdentity,
  generateIdentity,
  saveKey,
  shortNpub,
  type Identity,
} from "../lib/nostr";

const EXPANDED_KEY = "afqc-tauri.publish.expanded";

interface NostrPanelProps {
  identity: Identity | null;
  setIdentity: (i: Identity | null) => void;
  /**
   * The single relay used when publishing kind:1063 file metadata from
   * this app. Editable + persisted at the App level. Other Nostr reads
   * (FeedPanel) still use the broader DEFAULT_RELAYS set for coverage.
   */
  publishRelay: string;
  setPublishRelay: (v: string) => void;
  defaultPublishRelay: string;
}

export function NostrPanel({
  identity,
  setIdentity,
  publishRelay,
  setPublishRelay,
  defaultPublishRelay,
}: NostrPanelProps) {
  const [expanded, setExpanded] = usePersistedBool(EXPANDED_KEY, true);
  const [input, setInput] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [backupNsec, setBackupNsec] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleSave() {
    setErr(null);
    setBusy(true);
    try {
      const id = await saveKey(input);
      setIdentity(id);
      setInput("");
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleGenerate() {
    setErr(null);
    setBusy(true);
    try {
      const id = await generateIdentity();
      setIdentity({ npub: id.npub, pk: id.pk });
      setBackupNsec(id.nsec);
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleClear() {
    setErr(null);
    setBusy(true);
    try {
      await clearIdentity();
      setIdentity(null);
      setInput("");
      setBackupNsec(null);
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleCopyNsec() {
    if (!backupNsec) return;
    try {
      await navigator.clipboard.writeText(backupNsec);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard denied */
    }
  }

  return (
    <Section
      icon={<Radio size={16} aria-label="Publish" />}
      onTitleClick={() => setExpanded(!expanded)}
    >
      {expanded && (
        <>
      <div>
        <div className="text-[10px] uppercase tracking-wide text-muted mb-1">
          Identity
        </div>
        {identity ? (
          <div className="flex items-center gap-2 rounded-md bg-bg/50 px-2.5 py-1.5">
            <KeyRound size={12} className="text-accent shrink-0" />
            <span
              className="font-mono text-xs text-fg truncate flex-1"
              title={identity.npub}
            >
              {shortNpub(identity.npub)}
            </span>
            <button
              onClick={handleClear}
              disabled={busy}
              title="Forget this key (removes from OS keychain)"
              className="text-muted hover:text-alert shrink-0 disabled:opacity-50"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                type="password"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
                placeholder="nsec1…"
                disabled={busy}
                className="flex-1 px-2.5 py-1.5 rounded-md bg-surface text-fg
                           placeholder:text-muted outline-none border border-transparent
                           focus:border-accent/50 text-xs font-mono disabled:opacity-50"
                spellCheck={false}
                autoComplete="off"
              />
              <button
                onClick={handleSave}
                disabled={!input.trim() || busy}
                className="px-2.5 py-1.5 rounded-md bg-surface hover:bg-surfaceHover
                           text-fg disabled:opacity-50 text-xs"
              >
                Load
              </button>
            </div>
            <button
              onClick={handleGenerate}
              disabled={busy}
              className="w-full px-2.5 py-1.5 rounded-md bg-surface hover:bg-surfaceHover
                         text-fg text-xs flex items-center justify-center gap-1.5
                         disabled:opacity-50"
            >
              <Sparkles size={12} />
              Generate new key
            </button>
          </div>
        )}
        {err && (
          <p className="text-[10px] text-alert font-mono break-all mt-2">{err}</p>
        )}
      </div>

      <div>
        <div className="text-[10px] uppercase tracking-wide text-muted mb-1">
          Publish relay
        </div>
        <div className="flex items-center gap-2 rounded-md bg-bg/50 px-2.5 py-1.5">
          <Radio size={10} className="text-muted shrink-0" />
          <input
            type="text"
            value={publishRelay}
            onChange={(e) => setPublishRelay(e.target.value)}
            onBlur={() => {
              // Fall back to the default if the user cleared it — we
              // always want a populated value so the publish path can't
              // silently no-op.
              if (!publishRelay.trim()) setPublishRelay(defaultPublishRelay);
            }}
            spellCheck={false}
            className="flex-1 bg-transparent text-fg/90 text-xs font-mono outline-none"
          />
        </div>
      </div>

      {backupNsec && (
        <div className="rounded-md bg-warn/10 border border-warn/40 px-2.5 py-2 space-y-1.5">
          <div className="text-[10px] uppercase tracking-wide text-warn font-semibold">
            Back up your secret key
          </div>
          <p className="text-[11px] text-fg/80">
            The nsec is stored in your OS keychain, but it&apos;s only shown
            here once. Copy it somewhere safe — you can&apos;t recover it later.
          </p>
          <div className="flex items-center gap-2">
            <code className="font-mono text-[10px] text-fg truncate flex-1
                             rounded bg-bg/60 px-2 py-1">
              {backupNsec}
            </code>
            <button
              onClick={handleCopyNsec}
              className="text-muted hover:text-fg shrink-0"
              title={copied ? "Copied" : "Copy nsec"}
            >
              {copied ? <Check size={12} className="text-ok" /> : <Copy size={12} />}
            </button>
          </div>
          <button
            onClick={() => setBackupNsec(null)}
            className="text-[10px] text-muted hover:text-fg underline"
          >
            I&apos;ve saved it — dismiss
          </button>
        </div>
      )}

        </>
      )}
    </Section>
  );
}
