import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface AvatarRingProps {
  src?: string | null;
  name: string;
  accentColor?: string | null;
  size?: number;
  fallbackClassName?: string;
  className?: string;
}

export function AvatarRing({
  src,
  name,
  accentColor,
  size = 40,
  fallbackClassName,
  className,
}: AvatarRingProps) {
  const ring = accentColor || "transparent";
  return (
    <div
      className={cn("rounded-full p-[2px]", className)}
      style={{ background: accentColor ? ring : undefined }}
    >
      <Avatar
        style={{ width: size, height: size }}
        className="ring-2 ring-white"
      >
        <AvatarImage src={src ?? undefined} />
        <AvatarFallback
          className={cn("text-white font-bold", fallbackClassName)}
          style={{ background: accentColor || "#2C8214" }}
        >
          {name.slice(0, 1).toUpperCase()}
        </AvatarFallback>
      </Avatar>
    </div>
  );
}
