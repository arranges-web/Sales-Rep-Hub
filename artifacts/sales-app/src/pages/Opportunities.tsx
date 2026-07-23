import { useMemo, useState } from "react";
import { useListPins } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  Flame,
  Target,
  Navigation,
  Sparkles,
  ArrowRight,
  CheckCheck,
} from "lucide-react";
import { Link } from "wouter";
import { BrandHeader } from "@/components/BrandHeader";
import { cn } from "@/lib/utils";
import {
  findHotspots,
  HOTSPOT_TYPE_META,
  type Hotspot,
  type HotspotType,
} from "@/lib/opportunity";

type FilterKey = "all" | HotspotType;

export default function OpportunitiesPage() {
  const { data: pins } = useListPins();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [planned, setPlanned] = useState<Set<string>>(() => new Set());

  const hotspots = useMemo(() => findHotspots(pins), [pins]);

  const filtered = useMemo(
    () => (filter === "all" ? hotspots : hotspots.filter((h) => h.type === filter)),
    [hotspots, filter],
  );

  const totals = useMemo(() => {
    const acc = { goldmine: 0, warm: 0, pipeline: 0, cold: 0 } as Record<
      HotspotType,
      number
    >;
    hotspots.forEach((h) => {
      acc[h.type] += 1;
    });
    return acc;
  }, [hotspots]);

  const togglePlanned = (key: string) =>
    setPlanned((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const plannedList = hotspots.filter((h) => planned.has(h.key));
  const plannedRoute = plannedList
    .map((h) => `${h.centerLat},${h.centerLng}`)
    .join("/");
  const routeHref =
    plannedList.length > 0
      ? `https://www.google.com/maps/dir/${plannedRoute}`
      : null;

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6 lg:p-8">
      <BrandHeader
        title="Opportunity Finder"
        subtitle="Where the dollars are this week. Ranked by where the city's already converting + where leads are stacking up."
        icon={<TrendingUp className="h-6 w-6" strokeWidth={1.5} />}
        accent="#FFBF00"
        actions={
          <Link href="/map">
            <Button
              size="sm"
              variant="outline"
              className="rounded-lg"
              title="Jump to the canvas map"
            >
              Open map <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </Link>
        }
      />

      {/* Top: type counts + planning bar */}
      <div className="grid gap-3 sm:grid-cols-4">
        {(Object.keys(HOTSPOT_TYPE_META) as HotspotType[]).map((t) => {
          const meta = HOTSPOT_TYPE_META[t];
          return (
            <Card
              key={t}
              className={cn(
                "relative cursor-pointer overflow-hidden p-3 transition-all duration-200 hover:-translate-y-0.5",
                filter === t && "ring-2 ring-offset-0",
              )}
              style={{
                boxShadow:
                  filter === t ? `0 0 0 2px ${meta.color}` : undefined,
              }}
              onClick={() => setFilter(filter === t ? "all" : t)}
            >
              <div
                aria-hidden
                className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-20 blur-2xl"
                style={{ background: meta.color }}
              />
              <div className="relative flex items-center gap-2">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{
                    background: meta.color,
                    boxShadow: `0 0 8px ${meta.color}80`,
                  }}
                  aria-hidden
                />
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {meta.label}
                </span>
              </div>
              <div className="relative mt-1 font-stat text-3xl font-bold tabular-nums">
                {totals[t]}
              </div>
              <div className="relative text-[11px] text-muted-foreground">
                {meta.description}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Day-plan ribbon */}
      {plannedList.length > 0 && (
        <Card className="relative flex flex-wrap items-center gap-3 overflow-hidden p-3">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#FFBF00]/15 to-transparent"
          />
          <div className="relative flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="h-4 w-4 text-[#FFBF00]" />
            Day plan
            <Badge className="ml-1 rounded-full bg-[#FFBF00] text-slate-950">
              {plannedList.length}
            </Badge>
          </div>
          <div className="relative flex flex-wrap gap-1 text-xs text-muted-foreground">
            {plannedList.map((h, i) => (
              <span
                key={h.key}
                className="inline-flex items-center gap-1 rounded-full bg-background/60 px-2 py-0.5"
              >
                <span className="font-stat font-bold text-foreground">
                  {i + 1}.
                </span>
                {h.label}
              </span>
            ))}
          </div>
          <div className="relative ml-auto flex gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="rounded-lg"
              onClick={() => setPlanned(new Set())}
            >
              Clear
            </Button>
            {routeHref && (
              <a href={routeHref} target="_blank" rel="noreferrer">
                <Button
                  size="sm"
                  className="rounded-lg bg-[#3DA935] text-slate-950 hover:bg-[#4FBF45]"
                >
                  <Navigation className="mr-1 h-3.5 w-3.5" /> Drive route
                </Button>
              </a>
            )}
          </div>
        </Card>
      )}

      {/* Hotspot table */}
      {hotspots.length === 0 ? (
        <Card className="p-8 text-center">
          <Target className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <h3 className="text-lg font-bold">No data yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Drop some pins on the map. As soon as we see a few leads and a sold
            in the same neighborhood, the opportunity engine kicks in.
          </p>
          <Link href="/map">
            <Button className="mt-4 rounded-xl bg-[#3DA935] text-slate-950 hover:bg-[#4FBF45]">
              Open canvas map
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="grid gap-3 jt-fade-in-stagger">
          {filtered.map((h, i) => (
            <HotspotRow
              key={h.key}
              hotspot={h}
              rank={i + 1}
              planned={planned.has(h.key)}
              onTogglePlan={() => togglePlanned(h.key)}
            />
          ))}
          {filtered.length === 0 && (
            <Card className="p-6 text-center text-sm text-muted-foreground">
              No {filter} blocks right now. Try another filter.
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function HotspotRow({
  hotspot: h,
  rank,
  planned,
  onTogglePlan,
}: {
  hotspot: Hotspot;
  rank: number;
  planned: boolean;
  onTogglePlan: () => void;
}) {
  const meta = HOTSPOT_TYPE_META[h.type];
  const mapsHref = `https://www.google.com/maps/dir/?api=1&destination=${h.centerLat},${h.centerLng}`;
  const previewPins = h.pins.slice(0, 5);
  return (
    <Card
      className={cn(
        "relative overflow-hidden border-border transition-all duration-200",
        "hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-20px_rgba(255,191,0,0.45)]",
        planned && "ring-1 ring-[#FFBF00]/60",
      )}
    >
      {/* Soft side-accent */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-1.5"
        style={{ background: meta.color }}
      />
      <div className="flex flex-wrap items-start gap-4 p-4 pl-6">
        <div className="flex shrink-0 items-center gap-3">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-2xl text-slate-950 shadow-md"
            style={{
              background: meta.color,
              boxShadow: `0 8px 24px -10px ${meta.color}`,
            }}
          >
            <span className="font-stat text-lg font-extrabold tabular-nums">
              {rank}
            </span>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-lg font-bold leading-snug">
              {h.label}
            </h3>
            <Badge
              className="rounded-full border-0 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
              style={{ color: meta.color, background: `${meta.color}1f` }}
            >
              {meta.label}
            </Badge>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">{h.reason}</p>

          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
            <Stat label="Leads" value={h.leadCount} color="#14B8A6" />
            <Stat label="Sold" value={h.soldCount} color="#2C8214" />
            {h.staleLeadCount > 0 && (
              <Stat label="Stale" value={h.staleLeadCount} color="#a78bfa" />
            )}
            <Stat
              label="Convert"
              value={`${Math.round(h.soldRatio * 100)}%`}
              color="#FFBF00"
            />
            <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-foreground/5 px-2 py-1 font-stat font-bold tabular-nums">
              <Flame className="h-3.5 w-3.5 text-[#ff7a2d]" />
              {h.score.toFixed(1)}
            </span>
          </div>

          {previewPins.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {previewPins.map((p) => (
                <span
                  key={p.id}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-background/60 px-2 py-0.5 text-[11px]"
                  title={p.address}
                >
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full"
                    style={{
                      background: p.status === "sold" ? "#2C8214" : "#14B8A6",
                    }}
                    aria-hidden
                  />
                  {p.address.split(",")[0]}
                </span>
              ))}
              {h.pins.length > previewPins.length && (
                <span className="rounded-full px-2 py-0.5 text-[11px] text-muted-foreground">
                  +{h.pins.length - previewPins.length} more
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          <Link
            href={`/map?focus=${encodeURIComponent(h.key)}`}
            onClick={(e) => {
              // Wouter does its own navigation; the query param is just so the
              // Map page can wake up at the right hotspot later if it wants.
              void e;
            }}
          >
            <Button
              size="sm"
              variant="outline"
              className="w-full rounded-xl sm:w-auto"
            >
              <Target className="mr-1 h-3.5 w-3.5" /> Open on map
            </Button>
          </Link>
          <a href={mapsHref} target="_blank" rel="noreferrer">
            <Button
              size="sm"
              variant="outline"
              className="w-full rounded-xl sm:w-auto"
            >
              <Navigation className="mr-1 h-3.5 w-3.5" /> Directions
            </Button>
          </a>
          <Button
            size="sm"
            onClick={onTogglePlan}
            className={cn(
              "w-full rounded-xl sm:w-auto",
              planned
                ? "bg-[#FFBF00] text-slate-950 hover:bg-[#ffcd33]"
                : "bg-[#3DA935] text-slate-950 hover:bg-[#4FBF45]",
            )}
          >
            {planned ? (
              <>
                <CheckCheck className="mr-1 h-3.5 w-3.5" /> In plan
              </>
            ) : (
              <>
                <Sparkles className="mr-1 h-3.5 w-3.5" /> Add to plan
              </>
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background/40 px-2 py-1">
      <span
        aria-hidden
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ background: color }}
      />
      <span className="text-muted-foreground">{label}</span>
      <span className="font-stat font-bold text-foreground" style={{ color }}>
        {value}
      </span>
    </span>
  );
}
