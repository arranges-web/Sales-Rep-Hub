import { ReactNode } from "react";
import { TreePine } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title: string;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[#2EA3F2]/30 bg-gradient-to-b from-white to-[#2EA3F2]/5 px-6 py-10 text-center",
        className,
      )}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#2EA3F2] to-[#2C8214] text-white shadow-md">
        {icon ?? <TreePine className="h-7 w-7" />}
      </div>
      <div className="text-base font-bold text-foreground">{title}</div>
      {description ? (
        <div className="max-w-sm text-sm text-muted-foreground">
          {description}
        </div>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
