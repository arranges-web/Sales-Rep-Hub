import {
  useGetMe,
  useGetLeaderboardSummary,
  useListBadges,
  useListIncentiveTiers,
} from "@workspace/api-client-react";
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
  const { data: badges } = useListBadges({ userId: me?.id });
  const { data: tiers } = useListIncentiveTiers();

  const myPoints = me?.totalPoints ?? 0;
  const sortedTiers = (tiers ?? []).slice().sort((a, b) => a.pointThreshold - b.pointThreshold);
  const nextTier = sortedTiers.find((t) => t.pointThreshold > myPoints);
  const currentTier = sortedTiers.filter((t) => t.pointThreshold <= myPoints).slice(-1)[0];
  const progress = nextTier
    ? Math.min(100, ((myPoints - (currentTier?.pointThreshold ?? 0)) /
        (nextTier.pointThreshold - (currentTier?.pointThreshold ?? 0))) * 100)
    : 100;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
      <BrandHeader
        title={`Welcome back, ${me?.name?.split(" ")[0] ?? "Rep"} 🌳`}
        subtitle={
          me?.hawaiiGoal
            ? `🌺 ${me.hawaiiGoal}`
            : "Here's how the SWFL crew is crushing it today."
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
              <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-xs font-bold backdrop-blur">
                <TrendingUp className="h-3 w-3" /> Level {me.level}
              </span>
            )}
            {me?.currentStreak ? (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold backdrop-blur ${
                  me.streakAtRisk
                    ? "bg-[#FFBF00] text-slate-900"
                    : "bg-white/20 text-white"
                }`}
                title={
                  me.streakAtRisk
                    ? "Close one today to keep your streak alive!"
                    : `Best: ${me.bestStreak}`
                }
              >
                <Flame className="h-3 w-3" />
                {me.currentStreak}-day streak
              </span>
            ) : null}
          </div>
        }
      />

      {/* Points to Paradise */}
      <Card className="overflow-hidden border-0 bg-gradient-to-br from-[#2EA3F2] to-[#2C8214] p-6 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div className="relative">
            <div className="text-sm opacity-90">Your Points</div>
            <div className="relative inline-block">
              <AnimatedNumber
                value={myPoints}
                className="mt-1 block text-4xl font-extrabold tabular-nums"
              />
              <PointsDelta value={myPoints} />
            </div>
            {me?.pointsPerLevel ? (
              <div className="mt-1 text-xs opacity-80 tabular-nums">
                Level {me.level} • {me.pointsThisLevel}/{me.pointsPerLevel} to L{me.level + 1}
              </div>
            ) : null}
          </div>
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur">
            <Trophy className="h-7 w-7" />
          </div>
        </div>
        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-semibold">
              {currentTier?.name ?? "Just getting started"}
            </span>
            <span className="opacity-90">
              {nextTier
                ? `${(nextTier.pointThreshold - myPoints).toLocaleString()} pts to ${nextTier.name}`
                : "🏆 Top tier reached!"}
            </span>
          </div>
          <Progress value={progress} className="h-2.5 bg-white/25 [&>div]:bg-[#FFBF00]" />
          <div className="mt-3 text-xs opacity-90">
            🌺 Points to Paradise — Hawaii trip awaits the top earners.
          </div>
        </div>
      </Card>

      {summary == null ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <JTSkeletonCard key={i} rows={1} />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 jt-fade-in-stagger">
          <StatCard icon={DollarSign} label="Revenue This Month" value={`$${(summary.revenueThisMonth ?? 0).toLocaleString()}`} color="#2C8214" />
          <StatCard icon={Zap} label="Deals This Month" value={summary.dealsThisMonth ?? 0} color="#2EA3F2" />
          <StatCard icon={Trophy} label="Top Rep" value={summary.topRepName ?? "—"} color="#FFBF00" small />
          <StatCard icon={Award} label="My Badges" value={badges?.length ?? 0} color="#2C8214" />
        </div>
      )}

      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">Recent Badges</h2>
        </div>
        {badges == null ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <JTSkeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : badges.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 jt-fade-in-stagger">
            {badges.slice(0, 6).map((b) => (
              <div
                key={b.id}
                className="jt-tilt flex items-center gap-3 rounded-xl border border-border p-3"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FFBF00]/20 text-[#7a5a00]">
                  <Award className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm">{b.label}</div>
                  <div className="truncate text-xs text-muted-foreground">{b.description}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No badges yet"
            description="Close your first deal to unlock your first badge — Century Club, Hat Trick, and more await."
            icon={<Award className="h-7 w-7" />}
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
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  color: string;
  small?: boolean;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium text-muted-foreground">{label}</div>
          <div className={`mt-1 font-extrabold tabular-nums ${small ? "text-lg" : "text-2xl"}`}>
            {value}
          </div>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: `${color}20`, color }}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </Card>
  );
}
