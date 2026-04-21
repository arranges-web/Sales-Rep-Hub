import { useGetLeaderboard, useListIncentiveTiers } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Trophy, Award } from "lucide-react";
import { cn } from "@/lib/utils";

export default function LeaderboardPage() {
  const { data: rows } = useGetLeaderboard();
  const { data: tiers } = useListIncentiveTiers();
  const sortedTiers = (tiers ?? []).slice().sort((a, b) => b.pointThreshold - a.pointThreshold);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
          Leaderboard 🏆
        </h1>
        <p className="mt-1 text-muted-foreground">
          Closed deals only. Cutoff lines show incentive tiers.
        </p>
      </div>

      <Card className="overflow-hidden">
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
                    <div className="flex items-center gap-3 bg-muted/50 px-4 py-2">
                      <div className="h-px flex-1" style={{ backgroundColor: cutoff.color }} />
                      <span
                        className="rounded-full px-2.5 py-0.5 text-xs font-bold text-white"
                        style={{ backgroundColor: cutoff.color }}
                      >
                        {cutoff.name} cutoff — {cutoff.pointThreshold.toLocaleString()} pts
                      </span>
                      <div className="h-px flex-1" style={{ backgroundColor: cutoff.color }} />
                    </div>
                  );
                })()}
                <div
                  className={cn(
                    "flex items-center gap-4 px-4 py-3 sm:px-5",
                    r.isCurrentUser && "bg-[#2EA3F2]/8",
                  )}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-bold tabular-nums">
                    {r.rank === 1 ? (
                      <Trophy className="h-6 w-6 text-[#FFBF00]" />
                    ) : (
                      <span className={cn(
                        "text-sm",
                        r.rank === 2 && "text-slate-500",
                        r.rank === 3 && "text-amber-700",
                      )}>#{r.rank}</span>
                    )}
                  </div>
                  <div
                    className="rounded-full p-[2px]"
                    style={{ background: r.accentColor || "#2C8214" }}
                  >
                    <Avatar className="h-11 w-11 ring-2 ring-white">
                      <AvatarImage src={r.avatarUrl ?? undefined} />
                      <AvatarFallback
                        className="text-white"
                        style={{ background: r.accentColor || "#2C8214" }}
                      >
                        {r.name.slice(0, 1)}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className="truncate font-bold"
                        title={r.bio ?? undefined}
                      >{r.name}</span>
                      {r.isCurrentUser && (
                        <Badge className="bg-[#2EA3F2] text-white">You</Badge>
                      )}
                      {r.hometown && (
                        <span className="hidden truncate text-xs text-muted-foreground sm:inline">
                          · {r.hometown}
                        </span>
                      )}
                      {tierMet && (
                        <Badge
                          className="text-white"
                          style={{ backgroundColor: tierMet.color }}
                        >
                          {tierMet.name}
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {r.dealsCount} deals • ${r.totalRevenue.toLocaleString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-extrabold tabular-nums text-[#2EA3F2]">
                      {r.totalPoints.toLocaleString()}
                    </div>
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">pts</div>
                  </div>
                  {r.badges.length > 0 && (
                    <div className="hidden sm:flex items-center gap-1">
                      {r.badges.slice(0, 3).map((b) => (
                        <div
                          key={b.id}
                          title={b.label}
                          className="flex h-7 w-7 items-center justify-center rounded-full bg-[#FFBF00]/20 text-[#7a5a00]"
                        >
                          <Award className="h-3.5 w-3.5" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {rows && rows.length === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No reps yet. Sign up your team to see the board light up!
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
