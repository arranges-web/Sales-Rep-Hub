import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface BrandHeaderProps {
  title: string;
  subtitle?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  className?: string;
  /** Accent stripe color (defaults to JT cyan). Use gold for big-deal pages. */
  accent?: string;
}

export function BrandHeader({
  title,
  subtitle,
  icon,
  actions,
  className,
  accent = "#3DA935",
}: BrandHeaderProps) {
  return (
    <div
      className={cn(
        "relative isolate overflow-hidden rounded-2xl border border-border bg-card px-5 py-5 shadow-sm sm:px-7 sm:py-6",
        // Subtle gradient surface gives the header a "premium" feel without
        // shouting for attention.
        "bg-gradient-to-br from-card via-card to-background/70",
        className,
      )}
    >
      {/* Thin accent stripe along the top edge */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
        }}
        aria-hidden
      />
      {/* Soft accent glow in the top-right corner — slow orbit so it feels alive */}
      <div
        className="jt-orbit pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full opacity-25 blur-3xl"
        style={{ background: accent }}
        aria-hidden
      />
      {/* Counter-glow on the opposite corner in a complementary green for depth */}
      <div
        className="pointer-events-none absolute -left-24 -bottom-24 h-56 w-56 rounded-full opacity-10 blur-3xl"
        style={{ background: "#2C8214" }}
        aria-hidden
      />

      <div className="relative flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {icon ? (
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-background/70 text-foreground shadow-sm backdrop-blur-sm"
              style={{
                boxShadow: `inset 0 0 0 1px ${accent}33, 0 4px 14px -6px ${accent}55`,
              }}
            >
              {icon}
            </div>
          ) : null}
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-[28px]">
              {title}
            </h1>
            {subtitle ? (
              <div className="mt-0.5 text-sm text-muted-foreground sm:text-[15px]">
                {subtitle}
              </div>
            ) : null}
          </div>
        </div>
        {actions ? (
          <div className="flex items-center gap-2">{actions}</div>
        ) : null}
      </div>
    </div>
  );
}
