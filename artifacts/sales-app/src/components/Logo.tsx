import { cn } from "@/lib/utils";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export function Logo({
  className,
  alt = "Joshua Tree Inc.",
}: {
  className?: string;
  alt?: string;
}) {
  return (
    <img
      src={`${basePath}/logo.png`}
      alt={alt}
      className={cn("h-9 w-auto select-none", className)}
      draggable={false}
    />
  );
}
