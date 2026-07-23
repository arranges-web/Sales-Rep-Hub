import { cn } from "@/lib/utils";

export function Logo({
  className,
  alt = "Joshua Tree Inc.",
}: {
  className?: string;
  alt?: string;
}) {
  return (
    <img
      src="/joshua-tree-logo.png"
      alt={alt}
      className={cn("h-9 w-auto select-none object-contain", className)}
      draggable={false}
    />
  );
}
