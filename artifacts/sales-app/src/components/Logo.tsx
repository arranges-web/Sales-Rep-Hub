import { cn } from "@/lib/utils";

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
      viewBox="0 0 200 60"
      className={cn("h-9 w-auto select-none", className)}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
    >
      <rect
        x="2"
        y="2"
        width="56"
        height="56"
        rx="12"
        fill="hsl(var(--card))"
        stroke="hsl(var(--border))"
        strokeWidth="1"
      />
      <path
        d="M30 14 L30 46 M22 22 L30 14 L38 22 M20 30 L30 20 L40 30 M18 38 L30 26 L42 38"
        stroke="#2EA3F2"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <text
        x="68"
        y="28"
        fontFamily="Inter, ui-sans-serif, system-ui, sans-serif"
        fontWeight="700"
        fontSize="17"
        letterSpacing="0.06em"
        fill="hsl(var(--foreground))"
      >
        JOSHUA
      </text>
      <text
        x="68"
        y="48"
        fontFamily="Inter, ui-sans-serif, system-ui, sans-serif"
        fontWeight="700"
        fontSize="17"
        letterSpacing="0.06em"
        fill="hsl(var(--foreground))"
      >
        TREE
      </text>
      <rect x="68" y="32" width="22" height="2" fill="#FFBF00" rx="1" />
    </svg>
  );
}
