import { useState } from "react";
import { useListTrainingResources } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GraduationCap, FileText, Trees, MessageSquare, Lightbulb, Folder, ExternalLink } from "lucide-react";
import { BrandHeader } from "@/components/BrandHeader";
import { EmptyState } from "@/components/EmptyState";

const CATEGORY_META: Record<string, { label: string; icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; color: string }> = {
  sales_script: { label: "Scripts", icon: MessageSquare, color: "#2EA3F2" },
  tree_identification: { label: "Tree ID", icon: Trees, color: "#2C8214" },
  product_knowledge: { label: "Product", icon: Lightbulb, color: "#FFBF00" },
  objection_handling: { label: "Objections", icon: FileText, color: "#a78bfa" },
  other: { label: "Other", icon: Folder, color: "#94a3b8" },
};

export default function TrainingPage() {
  const { data: resources } = useListTrainingResources();
  const [filter, setFilter] = useState<string>("all");

  const filtered = (resources ?? []).filter((r) => filter === "all" || r.category === filter);
  const categories = Array.from(new Set((resources ?? []).map((r) => r.category)));

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6 lg:p-8">
      <BrandHeader
        title="Training Vault"
        subtitle="Scripts, tree ID, objection handlers, pricing."
        icon={<GraduationCap className="h-6 w-6" strokeWidth={1.5} />}
      />

      <div className="flex flex-wrap gap-1.5">
        <Button
          size="sm"
          variant={filter === "all" ? "default" : "outline"}
          className={filter === "all" ? "rounded-lg bg-[#2EA3F2] text-slate-950 hover:bg-[#48b3f6]" : "rounded-lg border-border"}
          onClick={() => setFilter("all")}
        >
          All
        </Button>
        {categories.map((c) => {
          const meta = CATEGORY_META[c] ?? CATEGORY_META.other;
          const Icon = meta.icon;
          const active = filter === c;
          return (
            <Button
              key={c}
              size="sm"
              variant={active ? "default" : "outline"}
              className={
                active
                  ? "rounded-lg bg-[#2EA3F2] text-slate-950 hover:bg-[#48b3f6] gap-1.5"
                  : "rounded-lg border-border gap-1.5"
              }
              onClick={() => setFilter(c)}
            >
              <Icon className="h-3.5 w-3.5" strokeWidth={1.75} /> {meta.label}
            </Button>
          );
        })}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 jt-fade-in-stagger">
        {filtered.map((r) => {
          const meta = CATEGORY_META[r.category] ?? CATEGORY_META.other;
          const Icon = meta.icon;
          return (
            <Card key={r.id} className="jt-card-hover overflow-hidden flex flex-col border-border bg-card">
              {r.thumbnailUrl ? (
                <div className="relative h-28 w-full overflow-hidden">
                  <div
                    className="absolute inset-0"
                    style={{ background: `url(${r.thumbnailUrl}) center/cover` }}
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-card to-transparent opacity-80" />
                </div>
              ) : (
                <div
                  className="h-20 w-full"
                  style={{ background: `linear-gradient(135deg, ${meta.color}30, transparent)` }}
                />
              )}
              <div className="flex flex-1 flex-col p-4">
                <div className="flex items-center gap-2">
                  <div
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-border"
                    style={{ backgroundColor: `${meta.color}14`, color: meta.color }}
                  >
                    <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </div>
                  <span
                    className="font-stat rounded border px-1.5 text-[10px] font-bold uppercase tracking-wide"
                    style={{
                      color: meta.color,
                      borderColor: `${meta.color}66`,
                      background: `${meta.color}14`,
                    }}
                  >
                    {meta.label}
                  </span>
                </div>
                <h3 className="mt-2 font-bold text-foreground">{r.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground line-clamp-3">
                  {r.description}
                </p>
                {r.contentText && (
                  <div className="mt-3 max-h-32 overflow-y-auto rounded-md border border-border bg-background/40 p-3 text-xs whitespace-pre-wrap text-foreground/85">
                    {r.contentText}
                  </div>
                )}
                {r.contentUrl && (
                  <Button
                    asChild
                    size="sm"
                    className="mt-3 rounded-lg bg-[#2EA3F2] text-slate-950 hover:bg-[#48b3f6] gap-1.5"
                  >
                    <a href={r.contentUrl} target="_blank" rel="noopener noreferrer">
                      Open <ExternalLink className="h-3 w-3" />
                    </a>
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
        {filtered.length === 0 && (
          <div className="col-span-full">
            <EmptyState
              title="No training yet"
              description="Ask your admin to drop in scripts and guides."
              icon={<GraduationCap className="h-6 w-6" strokeWidth={1.5} />}
            />
          </div>
        )}
      </div>
    </div>
  );
}
