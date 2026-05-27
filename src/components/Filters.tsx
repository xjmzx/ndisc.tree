import { useEffect, useRef } from "react";
import { ChevronDown, Search } from "lucide-react";
import { VERDICTS, type Verdict } from "../lib/tauri";

export type SampleFilter = "all" | "sampled" | "unsampled";

export interface FilterState {
  verdict: "All" | Verdict;
  search: string;
  /**
   * Filter by whether a track has a 10s clip on disk under the workspace
   * dest. Set to `"all"` to ignore. App-level `hasSample` decides per row.
   */
  sample: SampleFilter;
}

interface FiltersProps {
  filter: FilterState;
  setFilter: (f: FilterState) => void;
  counts: Record<Verdict, number>;
  total: number;
}

const VERDICT_COLOR: Record<Verdict, string> = {
  LOSSLESS: "text-ok",
  "PROBABLY-LOSSY": "text-alert",
  UNCERTAIN: "text-warn",
  LOSSY: "text-mauve",
  UNKNOWN: "text-muted",
};

/**
 * Bare filter controls — no Section wrapper of its own; the parent
 * Library Section embeds these as a header band. Hidden when the
 * Library Section is collapsed.
 */
export function Filters({ filter, setFilter, counts, total }: FiltersProps) {
  const searchRef = useRef<HTMLInputElement>(null);

  // Ctrl+F focuses the search box (matches the Tk app's binding).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex flex-wrap gap-3 items-center">
      {/* appearance-none + custom chevron because WebKit2GTK applies the
          system GTK theme to native <select> (often white-on-grey),
          ignoring our bg-bg / text-fg. */}
      <div className="relative">
        <select
          value={filter.verdict}
          onChange={(e) => setFilter({ ...filter, verdict: e.target.value as FilterState["verdict"] })}
          className="appearance-none pl-3 pr-8 py-2 rounded-md bg-bg text-fg outline-none
                     border border-transparent focus:border-accent/50 text-sm cursor-pointer"
        >
          <option value="All">All</option>
          {VERDICTS.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
        <ChevronDown
          size={14}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
        />
      </div>

      <div className="relative" title="Filter by sampled-on-disk status">
        <select
          value={filter.sample}
          onChange={(e) =>
            setFilter({ ...filter, sample: e.target.value as SampleFilter })
          }
          className="appearance-none pl-3 pr-8 py-2 rounded-md bg-bg text-fg outline-none
                     border border-transparent focus:border-accent/50 text-sm cursor-pointer"
        >
          <option value="all">All</option>
          <option value="sampled">Sampled</option>
          <option value="unsampled">Unsampled</option>
        </select>
        <ChevronDown
          size={14}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
        />
      </div>

      <div className="flex-1 min-w-[200px] relative">
        <Search
          size={14}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
        />
        <input
          ref={searchRef}
          type="text"
          value={filter.search}
          onChange={(e) => setFilter({ ...filter, search: e.target.value })}
          placeholder="search path…  (Ctrl+F · Esc clears)"
          className="w-full pl-8 pr-3 py-2 rounded-md bg-surface text-fg
                     placeholder:text-muted outline-none border border-transparent
                     focus:border-accent/50 text-sm"
          spellCheck={false}
        />
      </div>

      {total > 0 && (
        <div className="ml-auto text-xs text-muted flex flex-wrap gap-x-4 gap-y-1
                        items-center justify-end text-right">
          <span>{total.toLocaleString()} tracks</span>
          {VERDICTS.filter((v) => counts[v] > 0).map((v) => (
            <span key={v} className={VERDICT_COLOR[v]}>
              {counts[v].toLocaleString()} {v.toLowerCase()}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
