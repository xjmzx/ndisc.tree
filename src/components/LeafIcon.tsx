import type { SVGProps } from "react";
import { cn } from "../lib/cn";

/**
 * The suite's "leaf" glyph — a simple almond blade + midrib, drawn in the
 * lucide idiom (24×24, currentColor stroke, round caps, stroke-width 2). Used
 * for affordance / brand marks (the clip filter toggle, per-scope sample
 * buttons, the Sample panel header). Quantity is shown with LeafDots.
 */
export function LeafIcon({
  size = 24,
  ...props
}: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {/* blade — pointed almond (tip top, stem base bottom) */}
      <path d="M12 21C6 16 6 9 12 4C18 9 18 16 12 21Z" />
      {/* midrib */}
      <path d="M12 20V5" />
    </svg>
  );
}

/**
 * Leaf-dots — the suite's diagrammatic quantity glyph (shared with ndisc /
 * ndisc.smpl). A leaf is a track; each track is one flat, muted leaf-green dot,
 * and the dots stack into a compact cluster (wrap at 5 per row) so the count
 * itself is the picture — leaves piling on a branch. Renders nothing for 0.
 * Capped at `max` (default 99); the exact figure stays in the hover title.
 */
// Optimal column count for `n` dots within `maxCols`: single row up to the
// smaller of 5 / maxCols, then the fewest rows that fit, columns balanced
// (6→2×3, 8→2×4, 7→4+3). Low maxCols = taller/narrower; high = shorter/wider.
function dotCols(n: number, maxCols: number): number {
  if (n <= Math.min(5, maxCols)) return n;
  const rows = Math.ceil(n / maxCols);
  return Math.ceil(n / rows);
}

export function LeafDots({
  n,
  total,
  max = 99,
  unit = "track",
  maxCols = 5,
  className,
}: {
  /** Present count (solid green dots). */
  n: number | null | undefined;
  /** Expected total — extra (missing) slots render at 25%. */
  total?: number | null;
  max?: number;
  unit?: string;
  /** Max dots per row — lower = taller/narrower, higher = shorter/wider. */
  maxCols?: number;
  className?: string;
}) {
  const present = Math.min(Math.max(n ?? 0, 0), max);
  const expected = total != null ? Math.min(Math.max(total, 0), max) : present;
  const shown = Math.max(present, expected);
  if (shown <= 0) return null;
  const missing = Math.max(expected - present, 0);
  const cols = dotCols(shown, maxCols);
  const title =
    total != null
      ? `${present} of ${total} ${unit}${total === 1 ? "" : "s"}${
          missing > 0 ? ` · ${missing} missing` : " · complete"
        }`
      : `${present}${present >= max ? "+" : ""} ${unit}${present === 1 ? "" : "s"}`;
  return (
    <span
      className={cn("inline-grid gap-[2px] w-max", className)}
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      title={title}
      aria-label={title}
    >
      {Array.from({ length: shown }, (_, i) => (
        <span
          key={i}
          className={cn(
            "w-1 h-1 rounded-full",
            i < present ? "bg-ok/70" : "bg-ok/25",
          )}
        />
      ))}
    </span>
  );
}

/**
 * Release-tree — the artist-level counterpart to LeafDots, using the same dot
 * unit so ndisc.tree reads as one visual language. An artist's releases are a
 * canopy of tiny leaf-green dots (one per release) on a shared auburn stem: a
 * little dot-leaved tree. Centred canopy, wrap at ~5, capped at `max`.
 */
export function ReleaseTree({
  n,
  max = 99,
  className,
}: {
  n: number | null | undefined;
  max?: number;
  className?: string;
}) {
  const raw = Math.max(n ?? 0, 0);
  const count = Math.min(raw, max);
  if (count <= 0) return null;
  const title = `${raw}${raw >= max ? "+" : ""} release${raw === 1 ? "" : "s"}`;
  return (
    <span
      className={cn("inline-flex flex-col items-center gap-px", className)}
      title={title}
      aria-label={title}
    >
      {/* canopy — one dot per release, centred so it crowns the stem */}
      <span className="flex flex-wrap justify-center gap-[2px] w-8">
        {Array.from({ length: count }, (_, i) => (
          <span key={i} className="w-1 h-1 rounded-full bg-ok/70" />
        ))}
      </span>
      {/* shared stem (trunk) */}
      <span className="w-0.5 h-1.5 rounded-sm bg-auburn/70" />
    </span>
  );
}

/**
 * A single small "dot tree" icon — a fixed canopy of dots on a short auburn
 * stem (decorative glyph, not a count; that's ReleaseTree). `dotClass`
 * recolours the canopy so it can double as a state toggle (e.g. the clip
 * filter: muted → green → mauve).
 */
export function DotTree({
  dotClass = "bg-ok/70",
  stemClass = "bg-auburn/70",
  className,
}: {
  dotClass?: string;
  stemClass?: string;
  className?: string;
}) {
  return (
    <span
      className={cn("inline-flex flex-col items-center gap-px", className)}
      aria-hidden="true"
    >
      <span className="flex flex-wrap justify-center gap-[2px] w-4">
        {Array.from({ length: 5 }, (_, i) => (
          <span
            key={i}
            className={cn("w-1 h-1 rounded-full transition-colors", dotClass)}
          />
        ))}
      </span>
      <span className={cn("w-0.5 h-1.5 rounded-sm", stemClass)} />
    </span>
  );
}

// One tiny tree within the forest glyph — smaller dots than DotTree.
function ForestTree({ dots }: { dots: number }) {
  return (
    <span className="inline-flex flex-col items-center gap-[1px]">
      <span className="flex flex-wrap justify-center gap-[1px] w-[7px]">
        {Array.from({ length: dots }, (_, i) => (
          <span key={i} className="w-[2px] h-[2px] rounded-full bg-ok/70" />
        ))}
      </span>
      <span className="w-px h-1 rounded-sm bg-auburn/70" />
    </span>
  );
}

/**
 * A mini forest — a few tiny dot-trees of varied height, base-aligned. The
 * Radio glyph: published samples out on the wire, as a little stand of trees.
 */
export function DotForest({ className }: { className?: string }) {
  return (
    <span
      className={cn("inline-flex items-end gap-[2px]", className)}
      aria-hidden="true"
    >
      <ForestTree dots={3} />
      <ForestTree dots={5} />
      <ForestTree dots={2} />
    </span>
  );
}
