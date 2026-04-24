import { useGetLeaderboard, useListIncentiveTiers } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Award, Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import { AvatarRing } from "@/components/AvatarRing";
import { BrandHeader } from "@/components/BrandHeader";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { JTSkeletonRow } from "@/components/Skeleton";
import { EmptyState } from "@/components/EmptyState";

export default function LeaderboardPage() {
  const { data: rows } = useGetLeaderboard();
  const { data: tiers } = useListIncentiveTiers();
  const sortedTiers = (tiers ?? []).slice().sort((a, b) => b.pointThreshold - a.pointThreshold);

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6 lg:p-8">
      <BrandHeader
        title="The Board"
        subtitle="Closed deals only. Cutoff lines mark incentive tiers."
        icon={<Trophy className="h-6 w-6 text-[#FFBF00]" strokeWidth={1.5} />}
        accent="#FFBF00"
      />

      <Card className="overflow-hidden border-border bg-card">
        <div className="divide-y divide-border">
          {(rows ?? []).map((r, idx) => {
            const tierMet = sortedTiers.find((t) => r.totalPoints >= t.pointThreshold);
            return (
              <div key={r.userId}>
                {/* Tier cutoff line BEFORE first rep below the threshold */}
                {idx > 0 && (() => {
                  const prev = rows![idx - 1];
                  const cutoff = sortedTiers.find(
                    (t) => prev.totalPoints >= t.pointThreshold && r.totalPoints < t.pointThreshold,
                  );
                  if (!cutoff) return null;
                  return (
                    <div className="flex items-center gap-3 bg-background/40 px-4 py-2">
                      <div className="h-px flex-1" style={{ backgroundColor: cutoff.color, opacity: 0.6 }} />
                      <span
                        className="font-stat rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em]"
                        style={{
                          color: cutoff.color,
                          borderColor: `${cutoff.color}66`,
                          background: `${cutoff.color}14`,
                        }}
                      >
                        {cutoff.name} · {cutoff.pointThreshold.toLocaleString()}
                      </span>
                      <div className="h-px flex-1" style={{ backgroundColor: cutoff.color, opacity: 0.6 }} />
                    </div>
                  );
                })()}
                <div
                  className={cn(
                    "jt-row-transition jt-fade-in flex items-center gap-4 px-4 py-3 sm:px-5",
                    r.isCurrentUser && "bg-[#2EA3F2]/8",
                  )}
                >
                  <div className="font-stat flex h-9 w-9 shrink-0 items-center justify-center rounded-md font-bold">
                    {r.rank === 1 ? (
                      <Trophy className="h-5 w-5 text-[#FFBF00]" strokeWidth={1.75} />
                    ) : (
                      <span className={cn(
                        "text-sm",
                        r.rank === 2 && "text-slate-300",
                        r.rank === 3 && "text-amber-600",
                        r.rank > 3 && "text-muted-foreground",
                      )}>{r.rank}</span>
                    )}
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
                      >{r.name}</span>
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
                          title={r.streakAtRisk ? "At risk — needs a deal today" : `Best: ${r.bestStreak}`}
                        >
                          <Flame className="h-2.5 w-2.5" />
                          {r.currentStreak}d
                        </span>
                      )}
                      {r.isCurrentUser && (
                        <Badge className="bg-[#2EA3F2]/20 text-[#2EA3F2] border border-[#2EA3F2]/40 text-[10px]">YOU</Badge>
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
                    <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">pts</div>
                  </div>
                  {r.badges.length > 0 && (
                    <div className="hidden sm:flex items-center gap-1">
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
                description="Close a few deals to light it up."
                icon={<Trophy className="h-6 w-6" strokeWidth={1.5} />}
              />
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
