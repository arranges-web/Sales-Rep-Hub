import { useState } from "react";
import { useListTrainingResources } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GraduationCap, FileText, TreePine, MessageSquare, Lightbulb, Folder } from "lucide-react";
import { BrandHeader } from "@/components/BrandHeader";

const CATEGORY_META: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  sales_script: { label: "Sales Scripts", icon: MessageSquare, color: "#2EA3F2" },
  tree_identification: { label: "FL Tree ID", icon: TreePine, color: "#2C8214" },
  product_knowledge: { label: "Product Knowledge", icon: Lightbulb, color: "#FFBF00" },
  objection_handling: { label: "Objection Handling", icon: FileText, color: "#9333ea" },
  other: { label: "Other", icon: Folder, color: "#64748b" },
};

export default function TrainingPage() {
  const { data: resources } = useListTrainingResources();
  const [filter, setFilter] = useState<string>("all");

  const filtered = (resources ?? []).filter((r) => filter === "all" || r.category === filter);
  const categories = Array.from(new Set((resources ?? []).map((r) => r.category)));

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
      <BrandHeader
        title="Training Vault"
        subtitle="Sales scripts, Florida tree identification, and more."
        icon={<GraduationCap className="h-6 w-6" />}
      />

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={filter === "all" ? "default" : "outline"}
          className="rounded-xl"
          onClick={() => setFilter("all")}
        >
          All
        </Button>
        {categories.map((c) => {
          const meta = CATEGORY_META[c] ?? CATEGORY_META.other;
          const Icon = meta.icon;
          return (
            <Button
              key={c}
              size="sm"
              variant={filter === c ? "default" : "outline"}
              className="rounded-xl gap-2"
              onClick={() => setFilter(c)}
            >
              <Icon className="h-3.5 w-3.5" /> {meta.label}
            </Button>
          );
        })}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((r) => {
          const meta = CATEGORY_META[r.category] ?? CATEGORY_META.other;
          const Icon = meta.icon;
          return (
            <Card key={r.id} className="overflow-hidden flex flex-col">
              <div
                className="h-28 w-full"
                style={{
                  background: r.thumbnailUrl
                    ? `url(${r.thumbnailUrl}) center/cover`
                    : `linear-gradient(135deg, ${meta.color}, ${meta.color}80)`,
                }}
              />
              <div className="flex flex-1 flex-col p-4">
                <div className="flex items-center gap-2">
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-white"
                    style={{ backgroundColor: meta.color }}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <Badge variant="outline">{meta.label}</Badge>
                </div>
                <h3 className="mt-2 font-bold">{r.title}</h3>
                <p className="mt-1 flex-1 text-sm text-muted-foreground line-clamp-3">
                  {r.description}
                </p>
                {r.contentText && (
                  <div className="mt-3 max-h-32 overflow-y-auto rounded-lg bg-muted/50 p-3 text-xs whitespace-pre-wrap">
                    {r.contentText}
                  </div>
                )}
                {r.contentUrl && (
                  <Button
                    asChild
                    size="sm"
                    className="mt-3 rounded-xl bg-[#2EA3F2] hover:bg-[#1d8fd8]"
                  >
                    <a href={r.contentUrl} target="_blank" rel="noopener noreferrer">
                      Open resource
                    </a>
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
        {filtered.length === 0 && (
          <Card className="col-span-full p-12 text-center">
            <GraduationCap className="mx-auto h-10 w-10 text-muted-foreground/50" />
            <p className="mt-3 text-sm text-muted-foreground">
              No training resources yet. Ask your admin to add some scripts and guides!
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
