import { useEffect, useMemo, useState } from "react";
import { useListTrainingResources } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  GraduationCap,
  FileText,
  Trees,
  MessageSquare,
  Lightbulb,
  Folder,
  ExternalLink,
  Search,
  CheckCircle2,
  Sparkles,
  Bookmark,
} from "lucide-react";
import { BrandHeader } from "@/components/BrandHeader";
import { EmptyState } from "@/components/EmptyState";
import { cn } from "@/lib/utils";

const CATEGORY_META: Record<
  string,
  {
    label: string;
    icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
    color: string;
  }
> = {
  sales_script: { label: "Scripts", icon: MessageSquare, color: "#2EA3F2" },
  tree_identification: { label: "Tree ID", icon: Trees, color: "#2C8214" },
  product_knowledge: { label: "Product", icon: Lightbulb, color: "#FFBF00" },
  objection_handling: { label: "Objections", icon: FileText, color: "#a78bfa" },
  other: { label: "Other", icon: Folder, color: "#94a3b8" },
};

const COMPLETED_KEY = "jt:training:completed";
const SAVED_KEY = "jt:training:saved";

function loadSet(key: string): Set<number> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((n) => typeof n === "number"));
  } catch {
    return new Set();
  }
}

function saveSet(key: string, set: Set<number>) {
  try {
    localStorage.setItem(key, JSON.stringify(Array.from(set)));
  } catch {
    /* ignore quota errors */
  }
}

export default function TrainingPage() {
  const { data: resources } = useListTrainingResources();
  const [filter, setFilter] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<number | null>(null);
  const [completed, setCompleted] = useState<Set<number>>(() => new Set());
  const [saved, setSaved] = useState<Set<number>>(() => new Set());

  // Hydrate completion/save state from localStorage after mount.
  useEffect(() => {
    setCompleted(loadSet(COMPLETED_KEY));
    setSaved(loadSet(SAVED_KEY));
  }, []);

  const toggleCompleted = (id: number) => {
    setCompleted((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      saveSet(COMPLETED_KEY, next);
      return next;
    });
  };
  const toggleSaved = (id: number) => {
    setSaved((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      saveSet(SAVED_KEY, next);
      return next;
    });
  };

  const categories = useMemo(
    () => Array.from(new Set((resources ?? []).map((r) => r.category))),
    [resources],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (resources ?? [])
      .filter((r) => filter === "all" || r.category === filter)
      .filter(
        (r) =>
          !q ||
          r.title.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q) ||
          (r.contentText ?? "").toLowerCase().includes(q),
      );
  }, [resources, filter, query]);

  const total = resources?.length ?? 0;
  const doneCount = (resources ?? []).filter((r) => completed.has(r.id)).length;
  const progress = total === 0 ? 0 : Math.round((doneCount / total) * 100);

  const openResource = open != null ? resources?.find((r) => r.id === open) : null;

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6 lg:p-8">
      <BrandHeader
        title="Training Vault"
        subtitle="Scripts, tree ID, objection handlers, pricing — built for the field."
        icon={<GraduationCap className="h-6 w-6" strokeWidth={1.5} />}
        actions={
          total > 0 ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {doneCount}/{total} complete
              </span>
              <div className="relative h-2 w-24 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#2EA3F2] to-[#2C8214] transition-[width] duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          ) : null
        }
      />

      {/* Hero card with search */}
      <Card className="relative overflow-hidden border-border/80">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-12 -right-10 h-48 w-48 rounded-full bg-[#2EA3F2]/15 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-16 -left-10 h-48 w-48 rounded-full bg-[#2C8214]/15 blur-3xl"
        />
        <div className="relative space-y-3 p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-[#FFBF00]" />
            Crew playbook
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder='Search scripts, objections, pricing… ("not interested", "termite", …)'
              className="rounded-xl pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Pill active={filter === "all"} onClick={() => setFilter("all")}>
              All
              <span className="ml-1.5 inline-flex items-center justify-center rounded bg-foreground/10 px-1 text-[10px] font-bold">
                {total}
              </span>
            </Pill>
            {categories.map((c) => {
              const meta = CATEGORY_META[c] ?? CATEGORY_META.other!;
              const Icon = meta.icon;
              const count = (resources ?? []).filter((r) => r.category === c).length;
              return (
                <Pill
                  key={c}
                  active={filter === c}
                  onClick={() => setFilter(c)}
                  accent={meta.color}
                >
                  <Icon className="h-3 w-3" strokeWidth={2} />
                  {meta.label}
                  <span className="ml-1 inline-flex items-center justify-center rounded bg-foreground/10 px-1 text-[10px] font-bold">
                    {count}
                  </span>
                </Pill>
              );
            })}
          </div>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 jt-fade-in-stagger">
        {filtered.map((r) => {
          const meta = CATEGORY_META[r.category] ?? CATEGORY_META.other!;
          const Icon = meta.icon;
          const isDone = completed.has(r.id);
          const isSaved = saved.has(r.id);
          return (
            <Card
              key={r.id}
              className={cn(
                "group relative flex cursor-pointer flex-col overflow-hidden border-border bg-card transition-all duration-200",
                "hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-20px_rgba(46,163,242,0.45)]",
                "hover:border-[#2EA3F2]/40",
              )}
              onClick={() => setOpen(r.id)}
            >
              {r.thumbnailUrl ? (
                <div className="relative h-32 w-full overflow-hidden">
                  <div
                    className="absolute inset-0 transition-transform duration-500 group-hover:scale-105"
                    style={{ background: `url(${r.thumbnailUrl}) center/cover` }}
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-card via-card/40 to-transparent" />
                </div>
              ) : (
                <div
                  className="h-24 w-full"
                  style={{
                    background: `linear-gradient(135deg, ${meta.color}40, ${meta.color}05)`,
                  }}
                />
              )}
              <div className="flex flex-1 flex-col p-4">
                <div className="flex items-center justify-between gap-2">
                  <Badge
                    className="gap-1 rounded-full border-0 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                    style={{
                      color: meta.color,
                      background: `${meta.color}1f`,
                    }}
                  >
                    <Icon className="h-3 w-3" strokeWidth={2.5} />
                    {meta.label}
                  </Badge>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSaved(r.id);
                      }}
                      className={cn(
                        "rounded-full p-1.5 transition-colors",
                        isSaved
                          ? "text-[#FFBF00] hover:bg-[#FFBF00]/15"
                          : "text-muted-foreground hover:bg-muted",
                      )}
                      title={isSaved ? "Unsave" : "Save for later"}
                      aria-label={isSaved ? "Unsave" : "Save for later"}
                    >
                      <Bookmark
                        className="h-4 w-4"
                        fill={isSaved ? "currentColor" : "none"}
                      />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleCompleted(r.id);
                      }}
                      className={cn(
                        "rounded-full p-1.5 transition-colors",
                        isDone
                          ? "text-[#2C8214] hover:bg-[#2C8214]/15"
                          : "text-muted-foreground hover:bg-muted",
                      )}
                      title={isDone ? "Mark not done" : "Mark complete"}
                      aria-label={isDone ? "Mark not done" : "Mark complete"}
                    >
                      <CheckCircle2
                        className="h-4 w-4"
                        fill={isDone ? "currentColor" : "none"}
                      />
                    </button>
                  </div>
                </div>
                <h3 className="mt-2 line-clamp-2 font-bold leading-tight text-foreground">
                  {r.title}
                </h3>
                <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">
                  {r.description}
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <Button
                    size="sm"
                    className="rounded-lg bg-[#2EA3F2] text-slate-950 hover:bg-[#48b3f6]"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpen(r.id);
                    }}
                  >
                    Open
                  </Button>
                  {r.contentUrl && (
                    <Button
                      size="sm"
                      variant="outline"
                      asChild
                      className="rounded-lg gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <a href={r.contentUrl} target="_blank" rel="noopener noreferrer">
                        Link <ExternalLink className="h-3 w-3" />
                      </a>
                    </Button>
                  )}
                </div>
              </div>
              {isDone && (
                <div className="pointer-events-none absolute right-2 top-2 rounded-full bg-[#2C8214] px-2 py-0.5 text-[10px] font-bold text-white shadow-md">
                  Done
                </div>
              )}
            </Card>
          );
        })}
        {filtered.length === 0 && (
          <div className="col-span-full">
            <EmptyState
              title={query ? "No matches" : "No training yet"}
              description={
                query
                  ? "Try a different search term."
                  : "Ask your admin to drop in scripts and guides."
              }
              icon={<GraduationCap className="h-6 w-6" strokeWidth={1.5} />}
            />
          </div>
        )}
      </div>

      {/* Full-content modal */}
      <Dialog open={open != null} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto rounded-2xl">
          {openResource && (
            <ResourceDetail
              resource={openResource}
              isDone={completed.has(openResource.id)}
              isSaved={saved.has(openResource.id)}
              onToggleDone={() => toggleCompleted(openResource.id)}
              onToggleSaved={() => toggleSaved(openResource.id)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Pill({
  active,
  onClick,
  accent = "#2EA3F2",
  children,
}: {
  active: boolean;
  onClick: () => void;
  accent?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
        active
          ? "border-transparent text-slate-950"
          : "border-border bg-background/50 text-foreground/80 hover:bg-muted",
      )}
      style={active ? { background: accent } : undefined}
    >
      {children}
    </button>
  );
}

function ResourceDetail({
  resource: r,
  isDone,
  isSaved,
  onToggleDone,
  onToggleSaved,
}: {
  resource: {
    id: number;
    title: string;
    description: string;
    category: string;
    contentText?: string | null;
    contentUrl?: string | null;
    thumbnailUrl?: string | null;
  };
  isDone: boolean;
  isSaved: boolean;
  onToggleDone: () => void;
  onToggleSaved: () => void;
}) {
  const meta = CATEGORY_META[r.category] ?? CATEGORY_META.other!;
  const Icon = meta.icon;
  return (
    <div className="space-y-4">
      <DialogHeader>
        <div className="flex items-center gap-2">
          <Badge
            className="gap-1 rounded-full border-0 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
            style={{ color: meta.color, background: `${meta.color}1f` }}
          >
            <Icon className="h-3 w-3" strokeWidth={2.5} />
            {meta.label}
          </Badge>
        </div>
        <DialogTitle className="text-xl leading-tight">{r.title}</DialogTitle>
      </DialogHeader>
      <p className="text-sm text-muted-foreground">{r.description}</p>
      {r.contentText && (
        <div className="prose prose-invert max-w-none whitespace-pre-wrap rounded-xl border border-border bg-background/40 p-4 text-sm leading-relaxed">
          {r.contentText}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {r.contentUrl && (
          <Button
            asChild
            className="rounded-xl bg-[#2EA3F2] text-slate-950 hover:bg-[#48b3f6]"
          >
            <a href={r.contentUrl} target="_blank" rel="noopener noreferrer">
              Open resource <ExternalLink className="ml-1 h-3.5 w-3.5" />
            </a>
          </Button>
        )}
        <Button
          variant="outline"
          className="rounded-xl gap-1.5"
          onClick={onToggleSaved}
        >
          <Bookmark className="h-4 w-4" fill={isSaved ? "currentColor" : "none"} />
          {isSaved ? "Saved" : "Save for later"}
        </Button>
        <Button
          className={cn(
            "rounded-xl gap-1.5",
            isDone
              ? "bg-[#2C8214] text-white hover:bg-[#246910]"
              : "bg-foreground text-background hover:bg-foreground/90",
          )}
          onClick={onToggleDone}
        >
          <CheckCircle2 className="h-4 w-4" />
          {isDone ? "Marked complete" : "Mark complete"}
        </Button>
      </div>
    </div>
  );
}
