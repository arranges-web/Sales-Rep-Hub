import { useState } from "react";
import {
  useGetLeaderboard,
  useListIncentiveTiers,
  getGetLeaderboardQueryKey,
  type GetLeaderboardParams,
} from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Award, Flame, Calendar, Infinity as InfinityIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { AvatarRing } from "@/components/AvatarRing";
import { BrandHeader } from "@/components/BrandHeader";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { JTSkeletonRow } from "@/components/Skeleton";
import { EmptyState } from "@/components/EmptyState";

type Period = "all_time" | "month";

const PERIOD_META: Record<
  Period,
  { label: string; icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; blurb: string }
> = {
  all_time: {
    label: "All-time",
    icon: InfinityIcon,
    blurb: "Total lifetime points. Closed deals only.",
  },
  month: {
    label: "This month",
    icon: Calendar,
    blurb: "Points earned since the 1st. Resets every month.",
  },
};

export default function LeaderboardPage() {
  const [period, setPeriod] = useState<Period>("all_time");
  const params: GetLeaderboardParams = { period };
  const { data: rows } = useGetLeaderboard(params, {
    query: { queryKey: getGetLeaderboardQueryKey(params) },
  });
  const { data: tiers } = useListIncentiveTiers();
  const sortedTiers = (tiers ?? [])
    .slice()
    .sort((a, b) => b.pointThreshold - a.pointThreshold);

  const PeriodIcon = PERIOD_META[period].icon;
  const podium = (rows ?? []).slice(0, 3);
  const rest = (rows ?? []).slice(3);

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6 lg:p-8">
      <BrandHeader
        title="The Board"
        subtitle={PERIOD_META[period].blurb}
        icon={<Trophy className="h-6 w-6 text-[#FFBF00]" strokeWidth={1.5} />}
        accent="#FFBF00"
        actions={
          <div className="inline-flex rounded-full border border-border bg-background/60 p-1 text-xs font-medium">
            {(Object.keys(PERIOD_META) as Period[]).map((p) => {
              const Icon = PERIOD_META[p].icon;
              const active = p === period;
              return (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors",
                    active
                      ? "bg-[#FFBF00] text-slate-950 shadow"
                      : "text-foreground/70 hover:text-foreground",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {PERIOD_META[p].label}
                </button>
              );
            })}
          </div>
        }
      />

      {/* Podium — visible only when there are enough reps to fill it */}
      {podium.length >= 1 && (
        <div className="grid items-end gap-3 sm:grid-cols-3">
          {/* Reorder so #1 is centered visually on desktop */}
          {[podium[1], podium[0], podium[2]]
            .filter(Boolean)
            .map((r, i) => {
              if (!r) return null;
              const place = r.rank;
              const ring =
                place === 1
                  ? "#FFBF00"
                  : place === 2
                    ? "#C0C7D1"
                    : "#C28455";
              const height =
                place === 1
                  ? "min-h-[230px]"
                  : place === 2
                    ? "min-h-[200px]"
                    : "min-h-[180px]";
              return (
                <Card
                  key={r.userId}
                  className={cn(
                    "relative isolate overflow-hidden p-4 text-center transition-all",
                    place === 1 && "sm:order-2",
                    place === 2 && "sm:order-1",
                    place === 3 && "sm:order-3",
                    height,
                  )}
                >
                  <div
                    aria-hidden
                    className="pointer-events-none absolute -top-12 left-1/2 h-28 w-28 -translate-x-1/2 rounded-full opacity-25 blur-2xl"
                    style={{ background: ring }}
                  />
                  {place === 1 && (
                    <div aria-hidden className="jt-sparkles" />
                  )}
                  <div className="relative mx-auto mb-2 flex flex-col items-center">
                    <div
                      className="mb-1 inline-flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-extrabold text-slate-950"
                      style={{
                        background: ring,
                        boxShadow: `0 6px 18px -6px ${ring}`,
                      }}
                    >
                      {place}
                    </div>
                    <div
                      className="rounded-full p-[2px]"
                      style={{
                        background: `conic-gradient(from 0deg, ${ring}, ${
                          r.accentColor ?? "#2EA3F2"
                        }, ${ring})`,
                      }}
                    >
                      <AvatarRing
                        src={r.avatarUrl}
                        name={r.name}
                        accentColor={r.accentColor}
                        size={place === 1 ? 72 : 60}
                        pulse={!!r.streakAtRisk}
                      />
                    </div>
                  </div>
                  <div className="relative truncate text-sm font-extrabold">
                    {r.name}
                  </div>
                  <div
                    className="font-stat relative mt-1 text-2xl font-extrabold tabular-nums"
                    style={{ color: ring }}
                  >
                    <AnimatedNumber value={r.totalPoints} />
                  </div>
                  <div className="relative text-[10px] uppercase tracking-wider text-muted-foreground">
                    {period === "month" ? "month pts" : "all-time pts"} ·{" "}
                    {r.dealsCount} deals
                  </div>
                  {r.currentStreak > 0 && (
                    <Badge
                      className={cn(
                        "relative mt-2 rounded-full border-0 text-[10px]",
                        r.streakAtRisk
                          ? "bg-[#FFBF00]/15 text-[#FFBF00]"
                          : "bg-[#2C8214]/15 text-[#7ed85c]",
                      )}
                    >
                      <Flame className="mr-1 h-3 w-3" /> {r.currentStreak}d
                    </Badge>
                  )}
                </Card>
              );
            })}
        </div>
      )}

      {/* Rest of the board */}
      <Card className="overflow-hidden border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border bg-background/30 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <PeriodIcon className="h-3.5 w-3.5 text-[#FFBF00]" />
          {PERIOD_META[period].label} · ranks {rest.length > 0 ? 4 : 1} & below
        </div>
        <div className="divide-y divide-border">
          {(rest ?? []).map((r, idx) => {
            const tierMet = sortedTiers.find(
              (t) => r.totalPoints >= t.pointThreshold,
            );
            return (
              <div key={r.userId}>
                {idx > 0 &&
                  (() => {
                    const prev = rest[idx - 1];
                    if (!prev) return null;
                    const cutoff = sortedTiers.find(
                      (t) =>
                        prev.totalPoints >= t.pointThreshold &&
                        r.totalPoints < t.pointThreshold,
                    );
                    if (!cutoff) return null;
                    return (
                      <div className="flex items-center gap-3 bg-background/40 px-4 py-2">
                        <div
                          className="h-px flex-1"
                          style={{ backgroundColor: cutoff.color, opacity: 0.6 }}
                        />
                        <span
                          className="font-stat rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em]"
                          style={{
                            color: cutoff.color,
                            borderColor: `${cutoff.color}66`,
                            background: `${cutoff.color}14`,
                          }}
                        >
                          {cutoff.name} ·{" "}
                          {cutoff.pointThreshold.toLocaleString()}
                        </span>
                        <div
                          className="h-px flex-1"
                          style={{ backgroundColor: cutoff.color, opacity: 0.6 }}
                        />
                      </div>
                    );
                  })()}
                <div
                  className={cn(
                    "jt-row-transition jt-fade-in flex items-center gap-4 px-4 py-3 sm:px-5",
                    r.isCurrentUser && "bg-[#2EA3F2]/8",
                  )}
                >
                  <div className="font-stat flex h-9 w-9 shrink-0 items-center justify-center rounded-md font-bold text-muted-foreground">
                    {r.rank}
                  </div>
                  <AvatarRing
                    src={r.avatarUrl}
                    name={r.name}
                    accentColor={r.accentColor}
                    size={42}
                    pulse={!!r.streakAtRisk}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className="truncate font-semibold text-foreground"
                        title={r.bio ?? undefined}
                      >
                        {r.name}
                      </span>
                      <span className="font-stat rounded border border-border bg-background/60 px-1 text-[9px] font-bold text-[#2EA3F2]">
                        L{r.level}
                      </span>
                      {r.currentStreak > 0 && (
                        <span
                          className={cn(
                            "font-stat inline-flex items-center gap-0.5 rounded px-1 text-[10px] font-bold",
                            r.streakAtRisk
                              ? "bg-[#FFBF00]/15 text-[#FFBF00]"
                              : "bg-[#2C8214]/15 text-[#7ed85c]",
                          )}
                          title={
                            r.streakAtRisk
                              ? "At risk — needs a deal today"
                              : `Best: ${r.bestStreak}`
                          }
                        >
                          <Flame className="h-2.5 w-2.5" />
                          {r.currentStreak}d
                        </span>
                      )}
                      {r.isCurrentUser && (
                        <Badge className="border border-[#2EA3F2]/40 bg-[#2EA3F2]/20 text-[10px] text-[#2EA3F2]">
                          YOU
                        </Badge>
                      )}
                      {r.hometown && (
                        <span className="hidden truncate text-xs text-muted-foreground sm:inline">
                          · {r.hometown}
                        </span>
                      )}
                      {tierMet && (
                        <span
                          className="font-stat rounded border px-1.5 text-[10px] font-bold uppercase tracking-wide"
                          style={{
                            color: tierMet.color,
                            borderColor: `${tierMet.color}66`,
                            background: `${tierMet.color}14`,
                          }}
                        >
                          {tierMet.name}
                        </span>
                      )}
                    </div>
                    <div className="font-stat text-xs text-muted-foreground">
                      {r.dealsCount} deals · ${r.totalRevenue.toLocaleString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <AnimatedNumber
                      value={r.totalPoints}
                      className="font-stat block text-lg font-extrabold text-foreground"
                    />
                    <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                      {period === "month" ? "mo pts" : "pts"}
                    </div>
                  </div>
                  {r.badges.length > 0 && (
                    <div className="hidden items-center gap-1 sm:flex">
                      {r.badges.slice(0, 3).map((b) => (
                        <div
                          key={b.id}
                          title={b.label}
                          className="flex h-6 w-6 items-center justify-center rounded border border-[#FFBF00]/30 bg-[#FFBF00]/10 text-[#FFBF00]"
                        >
                          <Award className="h-3 w-3" strokeWidth={1.75} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {rows == null && (
            <div className="space-y-2 p-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <JTSkeletonRow key={i} />
              ))}
            </div>
          )}
          {rows && rows.length === 0 && (
            <div className="p-6">
              <EmptyState
                title="The board is empty"
                description={
                  period === "month"
                    ? "Close a deal this month to light it up."
                    : "Close a few deals to light it up."
                }
                icon={<Trophy className="h-6 w-6" strokeWidth={1.5} />}
              />
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
