import { cn } from "@/lib/utils";

/**
 * Cleaner brand mark: a stylized "JT" formed by the J descender and a
 * stacked tree silhouette in JT cyan, with a gold accent underscore for
 * the wordmark. Single-color foreground respects the dark theme.
 */
export function Logo({
  className,
  alt = "Joshua Tree Inc.",
}: {
  className?: string;
  alt?: string;
}) {
  return (
    <svg
      role="img"
      aria-label={alt}
      viewBox="0 0 220 60"
      className={cn("h-9 w-auto select-none", className)}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
    >
      <defs>
        <linearGradient id="jt-mark-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#48b3f6" />
          <stop offset="100%" stopColor="#2EA3F2" />
        </linearGradient>
        <linearGradient id="jt-mark-shadow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(0,0,0,0.0)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.25)" />
        </linearGradient>
      </defs>

      {/* Glyph plate */}
      <rect
        x="2"
        y="2"
        width="56"
        height="56"
        rx="14"
        fill="hsl(var(--card))"
        stroke="hsl(var(--border))"
        strokeWidth="1"
      />
      <rect
        x="2"
        y="2"
        width="56"
        height="56"
        rx="14"
        fill="url(#jt-mark-shadow)"
      />

      {/* Tree silhouette: three branches stacked over a clean trunk + J hook */}
      <g
        fill="url(#jt-mark-grad)"
        stroke="url(#jt-mark-grad)"
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        {/* Top branch */}
        <path d="M30 13 L22 22 L38 22 Z" />
        {/* Middle branch */}
        <path d="M30 21 L19 31 L41 31 Z" />
        {/* Bottom branch */}
        <path d="M30 28 L16 40 L44 40 Z" />
      </g>
      {/* J hook trunk: descends and curls left to read as J + tree at once */}
      <path
        d="M30 38 L30 47 Q30 52 25 52 Q21 52 21 48"
        stroke="url(#jt-mark-grad)"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />

      {/* Wordmark */}
      <text
        x="72"
        y="33"
        fontFamily="Inter, ui-sans-serif, system-ui, sans-serif"
        fontWeight="800"
        fontSize="20"
        letterSpacing="0.04em"
        fill="hsl(var(--foreground))"
      >
        JOSHUA
      </text>
      <text
        x="72"
        y="51"
        fontFamily="Inter, ui-sans-serif, system-ui, sans-serif"
        fontWeight="500"
        fontSize="11"
        letterSpacing="0.32em"
        fill="hsl(var(--muted-foreground))"
      >
        TREE · SWFL
      </text>
      {/* Gold accent stroke under the wordmark */}
      <rect x="72" y="37" width="28" height="2" rx="1" fill="#FFBF00" />
    </svg>
  );
}
