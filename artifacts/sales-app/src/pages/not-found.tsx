import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="relative min-h-[100dvh] w-full flex items-center justify-center bg-background px-4">
      <div className="pointer-events-none absolute inset-0 jt-grid-bg opacity-50" />
      <div className="relative w-full max-w-md rounded-xl border border-border bg-card p-8 text-center shadow-[0_0_0_1px_rgba(255,255,255,0.04)]">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#2EA3F2]/10 ring-1 ring-[#2EA3F2]/30">
          <AlertTriangle className="h-6 w-6 text-[#2EA3F2]" />
        </div>
        <p className="font-stat text-xs uppercase tracking-[0.2em] text-muted-foreground">
          404
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground">
          Off the map.
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for isn't here. Head back to base.
        </p>
        <div className="mt-6">
          <Link href="/">
            <Button className="bg-[#2EA3F2] text-white hover:bg-[#2EA3F2]/90">
              Back to dashboard
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
