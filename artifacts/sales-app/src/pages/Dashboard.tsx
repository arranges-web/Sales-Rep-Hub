import {
  useGetMe,
  useGetLeaderboardSummary,
  useListIncentiveTiers,
  type Badge,
} from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Trophy, DollarSign, Zap, Award, Flame, TrendingUp } from "lucide-react";
import { AvatarRing } from "@/components/AvatarRing";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { BrandHeader } from "@/components/BrandHeader";
import { PointsDelta } from "@/components/PointsDelta";
import { JTSkeleton, JTSkeletonCard } from "@/components/Skeleton";
import { EmptyState } from "@/components/EmptyState";

export default function DashboardPage() {
  const { data: me } = useGetMe();
  const { data: summary } = useGetLeaderboardSummary();
  // Fetch badges via /badges/me — auth context resolves the rep, so this can
  // fire in parallel with getMe instead of waiting on me?.id to land.
  const { data: badges } = useQuery<Badge[]>({
    queryKey: ["/api/badges/me"],
    queryFn: async () => {
      const res = await fetch("/api/badges/me", { credentials: "include" });
      if (!res.ok) throw new Error(`badges/me ${res.status}`);
      return res.json();
    },
    staleTime: 60_000,
  });
  const { data: tiers } = useListIncentiveTiers();

  const myPoints = me?.totalPoints ?? 0;
  const sortedTiers = (tiers ?? []).slice().sort((a, b) => a.pointThreshold - b.pointThreshold);
  const nextTier = sortedTiers.find((t) => t.pointThreshold > myPoints);
  const currentTier = sortedTiers.filter((t) => t.pointThreshold <= myPoints).slice(-1)[0];
  const progress = nextTier
    ? Math.min(100, ((myPoints - (currentTier?.pointThreshold ?? 0)) /
        (nextTier.pointThreshold - (currentTier?.pointThreshold ?? 0))) * 100)
    : 100;

  const firstName = me?.name?.split(" ")[0] ?? "Rep";

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6 lg:p-8">
      <BrandHeader
        title={`Crush your week, ${firstName}.`}
        subtitle={
          me?.hawaiiGoal
            ? me.hawaiiGoal
            : "Live numbers from the SWFL crew."
        }
        icon={
          <AvatarRing
            src={me?.avatarUrl}
            name={me?.name ?? "Rep"}
            accentColor={me?.accentColor}
            size={36}
            pulse={!!me?.streakAtRisk}
          />
        }
        actions={
          <div className="flex flex-wrap gap-2">
            {me?.level != null && (
              <span className="font-stat inline-flex items-center gap-1 rounded-md border border-border bg-background/60 px-2.5 py-1 text-xs font-bold text-foreground">
                <TrendingUp className="h-3 w-3 text-[#2EA3F2]" /> L{me.level}
              </span>
            )}
            {me?.currentStreak ? (
              <span
                className={`font-stat inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-bold ${
                  me.streakAtRisk
                    ? "border-[#FFBF00]/50 bg-[#FFBF00]/10 text-[#FFBF00]"
                    : "border-[#2C8214]/40 bg-[#2C8214]/10 text-[#7ed85c]"
                }`}
                title={
                  me.streakAtRisk
                    ? "Close one today to keep your streak alive."
                    : `Best: ${me.bestStreak}`
                }
              >
                <Flame className="h-3 w-3" />
                {me.currentStreak}d streak
              </span>
            ) : null}
          </div>
        }
      />

      {/* Points headline */}
      <Card className="relative overflow-hidden border-border bg-card p-6">
        <div className="pointer-events-none absolute inset-0 jt-grid-bg opacity-30" />
        <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-[#2EA3F2]/15 blur-3xl" />
        <div className="relative flex items-center justify-between">
          <div className="relative">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Your Points
            </div>
            <div className="relative inline-block">
              <AnimatedNumber
                value={myPoints}
                className="font-stat mt-1 block text-5xl font-extrabold text-foreground"
              />
              <PointsDelta value={myPoints} />
            </div>
            {me?.pointsPerLevel ? (
              <div className="font-stat mt-1 text-xs text-muted-foreground">
                L{me.level} · {me.pointsThisLevel}/{me.pointsPerLevel} → L{me.level + 1}
              </div>
            ) : null}
          </div>
          <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-border bg-background text-[#FFBF00]">
            <Trophy className="h-7 w-7" strokeWidth={1.5} />
          </div>
        </div>
        <div className="relative mt-6">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span
              className="font-semibold uppercase tracking-[0.12em]"
              style={{ color: currentTier?.color ?? "var(--color-muted-foreground)" }}
            >
              {currentTier?.name ?? "Unranked"}
            </span>
            <span className="font-stat text-muted-foreground">
              {nextTier
                ? `${(nextTier.pointThreshold - myPoints).toLocaleString()} → ${nextTier.name}`
                : "TOP TIER"}
            </span>
          </div>
          <Progress value={progress} className="h-1.5 bg-muted [&>div]:bg-[#2EA3F2]" />
        </div>
      </Card>

      {summary == null ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <JTSkeletonCard key={i} rows={1} />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 jt-fade-in-stagger">
          <StatCard icon={DollarSign} label="Revenue MTD" value={`$${(summary.revenueThisMonth ?? 0).toLocaleString()}`} color="#2C8214" />
          <StatCard icon={Zap} label="Deals MTD" value={summary.dealsThisMonth ?? 0} color="#2EA3F2" />
          <StatCard icon={Trophy} label="Top Rep" value={summary.topRepName ?? "—"} color="#FFBF00" small />
          <StatCard icon={Award} label="My Badges" value={badges?.length ?? 0} color="#2C8214" />
        </div>
      )}

      <Card className="border-border bg-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold tracking-tight">Recent Badges</h2>
          {badges && badges.length > 0 && (
            <span className="font-stat text-xs text-muted-foreground">
              {badges.length} earned
            </span>
          )}
        </div>
        {badges == null ? (
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <JTSkeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : badges.length > 0 ? (
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 jt-fade-in-stagger">
            {badges.slice(0, 6).map((b) => (
              <div
                key={b.id}
                className="jt-card-hover flex items-center gap-3 rounded-lg border border-border bg-background/40 p-3"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-md border border-[#FFBF00]/30 bg-[#FFBF00]/10 text-[#FFBF00]">
                  <Award className="h-5 w-5" strokeWidth={1.75} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold">{b.label}</div>
                  <div className="truncate text-xs text-muted-foreground">{b.description}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No badges yet"
            description="Close your first deal to start earning badges."
            icon={<Award className="h-6 w-6" strokeWidth={1.5} />}
          />
        )}
      </Card>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
  small,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  value: string | number;
  color: string;
  small?: boolean;
}) {
  return (
    <Card className="jt-card-hover border-border bg-card p-4">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {label}
          </div>
          <div className={`font-stat mt-1.5 font-extrabold text-foreground ${small ? "text-base" : "text-2xl"}`}>
            {value}
          </div>
        </div>
        <div
          className="flex h-9 w-9 items-center justify-center rounded-md border border-border"
          style={{ backgroundColor: `${color}14`, color }}
        >
          <Icon className="h-4 w-4" strokeWidth={1.75} />
        </div>
      </div>
    </Card>
  );
}
