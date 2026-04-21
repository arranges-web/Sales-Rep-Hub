import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface BrandHeaderProps {
  title: string;
  subtitle?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function BrandHeader({
  title,
  subtitle,
  icon,
  actions,
  className,
}: BrandHeaderProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#2EA3F2] via-[#2C8214] to-[#1f6210] px-5 py-5 text-white shadow-sm sm:px-7 sm:py-6",
        className,
      )}
    >
      <div
        className="pointer-events-none absolute -right-12 -top-16 h-56 w-56 rounded-full bg-[#FFBF00]/20 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-20 -left-10 h-48 w-48 rounded-full bg-white/10 blur-3xl"
        aria-hidden
      />
      <div className="relative flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {icon ? (
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25 backdrop-blur">
              {icon}
            </div>
          ) : null}
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {title}
            </h1>
            {subtitle ? (
              <div className="mt-0.5 text-sm text-white/85 sm:text-base">
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
