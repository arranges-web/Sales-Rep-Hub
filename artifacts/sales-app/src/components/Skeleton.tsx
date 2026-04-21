import { cn } from "@/lib/utils";

export function JTSkeleton({
  className,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...rest} className={cn("jt-skeleton", className)} />;
}

export function JTSkeletonCard({ rows = 3 }: { rows?: number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <JTSkeleton className="h-5 w-1/3" />
      {Array.from({ length: rows }).map((_, i) => (
        <JTSkeleton key={i} className="h-4 w-full" />
      ))}
    </div>
  );
}

export function JTSkeletonRow() {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
      <JTSkeleton className="h-10 w-10 rounded-full" />
      <div className="flex-1 space-y-2">
        <JTSkeleton className="h-4 w-1/3" />
        <JTSkeleton className="h-3 w-1/4" />
      </div>
      <JTSkeleton className="h-5 w-12" />
    </div>
  );
}
