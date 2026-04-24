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
  accent = "#2EA3F2",
}: BrandHeaderProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border bg-card px-5 py-5 shadow-sm sm:px-7 sm:py-6",
        className,
      )}
    >
      {/* Single thin accent stripe along the top edge */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
        }}
        aria-hidden
      />
      {/* Subtle accent glow in the corner */}
      <div
        className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full opacity-20 blur-3xl"
        style={{ background: accent }}
        aria-hidden
      />

      <div className="relative flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {icon ? (
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-background/60 text-foreground"
              style={{ boxShadow: `inset 0 0 0 1px ${accent}22` }}
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
