import {
  useGetMe,
  useGetLeaderboardSummary,
  useListBadges,
  useListIncentiveTiers,
} from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Trophy, DollarSign, Zap, Award } from "lucide-react";
import { AvatarRing } from "@/components/AvatarRing";

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
      <div className="flex items-center gap-4">
        <AvatarRing
          src={me?.avatarUrl}
          name={me?.name ?? "Rep"}
          accentColor={me?.accentColor}
          size={56}
        />
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            Welcome back, {me?.name?.split(" ")[0] ?? "Rep"} 🌳
          </h1>
          <p className="mt-1 text-muted-foreground">
            {me?.hawaiiGoal
              ? `🌺 ${me.hawaiiGoal}`
              : "Here's how the SWFL crew is crushing it today."}
          </p>
        </div>
      </div>

      {/* Points to Paradise */}
      <Card className="overflow-hidden border-0 bg-gradient-to-br from-[#2EA3F2] to-[#2C8214] p-6 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm opacity-90">Your Points</div>
            <div className="mt-1 text-4xl font-extrabold tabular-nums">
              {myPoints.toLocaleString()}
            </div>
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={DollarSign} label="Revenue This Month" value={`$${(summary?.revenueThisMonth ?? 0).toLocaleString()}`} color="#2C8214" />
        <StatCard icon={Zap} label="Deals This Month" value={summary?.dealsThisMonth ?? 0} color="#2EA3F2" />
        <StatCard icon={Trophy} label="Top Rep" value={summary?.topRepName ?? "—"} color="#FFBF00" small />
        <StatCard icon={Award} label="My Badges" value={badges?.length ?? 0} color="#2C8214" />
      </div>

      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">Recent Badges</h2>
        </div>
        {badges && badges.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {badges.slice(0, 6).map((b) => (
              <div key={b.id} className="flex items-center gap-3 rounded-xl border border-border p-3">
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
          <p className="text-sm text-muted-foreground">
            Close your first deal to earn your first badge.
          </p>
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
