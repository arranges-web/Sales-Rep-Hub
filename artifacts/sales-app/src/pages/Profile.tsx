import { useEffect, useMemo, useState } from "react";
import {
  useGetMe,
  useUpdateMyProfile,
  useGetMyStats,
  useListFeedPosts,
  getGetMeQueryKey,
  getGetLeaderboardQueryKey,
  getListFeedPostsQueryKey,
  getListPinsQueryKey,
  getGetMyStatsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PhotoUpload } from "@/components/PhotoUpload";
import { AvatarRing } from "@/components/AvatarRing";
import { useToast } from "@/hooks/use-toast";
import {
  Save,
  Palette,
  UserCircle,
  Target,
  Trophy,
  Flame,
  Gift,
  MapPin,
  Award,
  TrendingUp,
  Calendar,
  Crown,
  Star,
  Zap,
  Sparkles,
  MessageSquareHeart,
  ChevronDown,
} from "lucide-react";
import { BrandHeader } from "@/components/BrandHeader";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

const PALETTE = [
  "#3DA935", "#2C8214", "#FFBF00",
  "#E11D48", "#7C3AED", "#0EA5E9",
  "#059669", "#F97316", "#475569",
];

const SERVICE_OPTIONS = [
  "Large Tree Removal",
  "Trimming & Pruning",
  "Stump Grinding",
  "Storm Cleanup",
  "Palm Care",
  "Other",
];

type Tier = {
  key: string;
  label: string;
  min: number;
  next: number | null;
  color: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
};
const TIERS: Tier[] = [
  { key: "bronze", label: "Bronze",   min: 0,     next: 2500,  color: "#C28455", icon: Star },
  { key: "silver", label: "Silver",   min: 2500,  next: 7500,  color: "#C0C7D1", icon: Zap },
  { key: "gold",   label: "Gold",     min: 7500,  next: 15000, color: "#FFBF00", icon: Trophy },
  { key: "plat",   label: "Platinum", min: 15000, next: 25000, color: "#A78BFA", icon: Crown },
  { key: "elite",  label: "Elite",    min: 25000, next: null,  color: "#3DA935", icon: Flame },
];

function tierFor(points: number): { tier: Tier; nextTier: Tier | null; progress: number } {
  let tier = TIERS[0]!;
  for (const t of TIERS) if (points >= t.min) tier = t;
  const nextTier =
    tier.next == null ? null : TIERS.find((t) => t.min === tier.next) ?? null;
  const span = tier.next == null ? 1 : tier.next - tier.min;
  const progress = tier.next == null ? 1 : Math.min(1, (points - tier.min) / span);
  return { tier, nextTier, progress };
}

export default function ProfilePage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: me } = useGetMe();
  const { data: stats } = useGetMyStats();
  const { data: allPosts } = useListFeedPosts();
  const update = useUpdateMyProfile();

  const [form, setForm] = useState({
    name: "",
    avatarUrl: null as string | null,
    accentColor: "#3DA935",
    hometown: "",
    bio: "",
    hawaiiGoal: "",
    favoriteService: "",
  });
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    if (!me) return;
    setForm({
      name: me.name ?? "",
      avatarUrl: me.avatarUrl ?? null,
      accentColor: me.accentColor ?? "#3DA935",
      hometown: me.hometown ?? "",
      bio: me.bio ?? "",
      hawaiiGoal: me.hawaiiGoal ?? "",
      favoriteService: me.favoriteService ?? "",
    });
  }, [me]);

  const myPosts = useMemo(() => {
    if (!me || !allPosts) return [];
    return allPosts.filter((p) => p.authorId === me.id).slice(0, 10);
  }, [allPosts, me]);

  const totalPoints = stats?.totalPoints ?? me?.totalPoints ?? 0;
  const { tier, nextTier, progress: tierProgress } = tierFor(totalPoints);
  const TierIcon = tier.icon;

  const lvl = stats
    ? { level: stats.level, nextLevelAt: stats.nextLevelAt }
    : me
      ? { level: me.level ?? 1, nextLevelAt: me.nextLevelAt ?? 100 }
      : { level: 1, nextLevelAt: 100 };
  const levelStart = Math.max(0, lvl.nextLevelAt - 100); // rough lower bound
  const levelProgress = Math.min(
    1,
    Math.max(0, (totalPoints - levelStart) / Math.max(1, lvl.nextLevelAt - levelStart)),
  );

  const save = async () => {
    await update.mutateAsync({
      data: {
        name: form.name.trim() || me?.name || "Rep",
        avatarUrl: form.avatarUrl,
        accentColor: form.accentColor,
        hometown: form.hometown || null,
        bio: form.bio || null,
        hawaiiGoal: form.hawaiiGoal || null,
        favoriteService: form.favoriteService || null,
      },
    });
    qc.invalidateQueries({ queryKey: getGetMeQueryKey() });
    qc.invalidateQueries({ queryKey: getGetLeaderboardQueryKey() });
    qc.invalidateQueries({ queryKey: getListFeedPostsQueryKey() });
    qc.invalidateQueries({ queryKey: getListPinsQueryKey() });
    qc.invalidateQueries({ queryKey: getGetMyStatsQueryKey() });
    toast({ title: "Profile saved" });
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6 lg:p-8">
      <BrandHeader
        title="My Profile"
        subtitle="Your story, your stats, your seat on the board."
        icon={<UserCircle className="h-6 w-6" strokeWidth={1.5} />}
        accent={form.accentColor}
      />

      {/* Hero */}
      <Card className="relative isolate overflow-hidden p-0">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background: `linear-gradient(135deg, ${form.accentColor}26 0%, transparent 60%)`,
          }}
        />
        <div
          aria-hidden
          className="jt-orbit pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full opacity-40 blur-3xl"
          style={{ background: form.accentColor }}
        />
        <div
          aria-hidden
          className="jt-orbit pointer-events-none absolute -left-24 -bottom-24 h-64 w-64 rounded-full opacity-25 blur-3xl"
          style={{ background: tier.color, animationDelay: "2s" }}
        />
        <div aria-hidden className="jt-sparkles" />

        <div className="relative grid gap-5 p-6 md:grid-cols-[1fr_auto] md:items-center">
          <div className="flex items-start gap-4">
            <div
              className="rounded-full p-[3px]"
              style={{
                background: `conic-gradient(from 0deg, ${form.accentColor}, ${tier.color}, ${form.accentColor})`,
              }}
            >
              <AvatarRing
                src={form.avatarUrl ?? me?.avatarUrl}
                name={form.name || "R"}
                accentColor={form.accentColor}
                size={88}
              />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-2xl font-extrabold tracking-tight">
                  {form.name || "Your name"}
                </h2>
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                  style={{ color: tier.color, background: `${tier.color}22` }}
                  title={`${tier.label} tier`}
                >
                  <TierIcon className="h-3 w-3" strokeWidth={2.5} /> {tier.label}
                </span>
                <span className="rounded border border-border bg-background/60 px-1.5 text-[10px] font-bold text-[#3DA935]">
                  L{lvl.level}
                </span>
                {stats && stats.currentStreak > 0 && (
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold",
                      stats.streakAtRisk
                        ? "bg-[#FFBF00]/15 text-[#FFBF00]"
                        : "bg-[#2C8214]/15 text-[#7ed85c]",
                    )}
                  >
                    <Flame className="h-3 w-3" />
                    {stats.currentStreak}d streak
                  </span>
                )}
              </div>
              <div className="text-sm text-muted-foreground">
                {form.hometown || "Add your hometown"}
                {me?.email && (
                  <>
                    {" · "}
                    <span className="text-foreground/70">{me.email}</span>
                  </>
                )}
              </div>
              {form.bio && (
                <p className="text-sm text-foreground/90">{form.bio}</p>
              )}
              {form.hawaiiGoal && (
                <div className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-[#FFBF00]/10 px-2 py-1 text-xs">
                  <Target className="h-3 w-3 text-[#FFBF00]" />
                  <span>Chasing: {form.hawaiiGoal}</span>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2 md:min-w-[260px]">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Lifetime balance
              </span>
              <span className="text-[10px] text-muted-foreground">
                {nextTier ? (
                  <>
                    <span className="font-stat font-bold tabular-nums text-foreground">
                      {(nextTier.min - totalPoints).toLocaleString()}
                    </span>{" "}
                    to {nextTier.label}
                  </>
                ) : (
                  <span className="font-bold text-[#FFBF00]">Top tier</span>
                )}
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <AnimatedNumber
                value={totalPoints}
                className="jt-brand-gradient font-stat text-5xl font-extrabold tabular-nums"
              />
              <span className="text-sm text-muted-foreground">pts</span>
            </div>
            <div className="space-y-1">
              <div className="h-1.5 overflow-hidden rounded-full bg-foreground/10">
                <div
                  className="h-full rounded-full transition-[width] duration-700"
                  style={{
                    width: `${Math.round(tierProgress * 100)}%`,
                    background: `linear-gradient(90deg, ${tier.color}, ${
                      nextTier?.color ?? tier.color
                    })`,
                    boxShadow: `0 0 10px ${tier.color}80`,
                  }}
                />
              </div>
              <div className="flex items-baseline justify-between text-[10px] text-muted-foreground">
                <span>Lv {lvl.level} progress</span>
                <span className="font-stat tabular-nums">
                  {Math.round(levelProgress * 100)}%
                </span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-foreground/10">
                <div
                  className="h-full rounded-full bg-[#3DA935]"
                  style={{ width: `${Math.round(levelProgress * 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Lifetime stat grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 jt-fade-in-stagger">
        <StatTile
          icon={<Sparkles />}
          color="#FFBF00"
          label="Month points"
          value={stats?.monthPoints ?? 0}
        />
        <StatTile
          icon={<Trophy />}
          color="#2C8214"
          label="Deals closed"
          value={stats?.dealsCount ?? 0}
          sub={stats ? `${stats.monthDealsCount} this month` : undefined}
        />
        <StatTile
          icon={<TrendingUp />}
          color="#3DA935"
          label="Revenue"
          value={`$${(stats?.totalRevenue ?? 0).toLocaleString()}`}
          sub={
            stats
              ? `$${stats.monthRevenue.toLocaleString()} this month`
              : undefined
          }
        />
        <StatTile
          icon={<MapPin />}
          color="#a78bfa"
          label="Pins dropped"
          value={stats?.pinsCount ?? 0}
          sub={stats ? `${stats.soldPinsCount} sold` : undefined}
        />
        <StatTile
          icon={<Award />}
          color="#FFBF00"
          label="Badges"
          value={stats?.badgesCount ?? 0}
        />
        <StatTile
          icon={<Gift />}
          color="#2C8214"
          label="Redemptions"
          value={stats?.redemptionsCount ?? 0}
        />
        <StatTile
          icon={<Flame />}
          color="#ff7a2d"
          label="Best streak"
          value={stats ? `${stats.bestStreak}d` : "—"}
          sub={stats ? `${stats.currentStreak}d current` : undefined}
        />
        <StatTile
          icon={<MessageSquareHeart />}
          color="#ec4899"
          label="Hype posts"
          value={stats?.feedPostsCount ?? 0}
        />
      </div>

      {/* Feed section */}
      <Card className="relative overflow-hidden p-5">
        <div className="mb-3 flex items-center gap-2">
          <MessageSquareHeart className="h-4 w-4 text-[#ec4899]" />
          <h2 className="text-base font-bold tracking-tight">My hype feed</h2>
          <span className="ml-auto text-xs text-muted-foreground">
            {myPosts.length} recent
          </span>
        </div>
        {myPosts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No posts yet. Drop a win in the Hype Feed to start your story.
          </p>
        ) : (
          <ol className="space-y-3">
            {myPosts.map((p) => (
              <li
                key={p.id}
                className="rounded-xl border border-border bg-background/40 p-3 transition-colors hover:bg-background/60"
              >
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  {formatDistanceToNow(new Date(p.createdAt), { addSuffix: true })}
                  {p.highFiveCount > 0 && (
                    <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-[#FFBF00]/15 px-1.5 py-0.5 text-[10px] font-bold text-[#FFBF00]">
                      🙌 {p.highFiveCount}
                    </span>
                  )}
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm">{p.content}</p>
                {p.imageUrl && (
                  <img
                    src={p.imageUrl}
                    alt=""
                    className="mt-2 max-h-44 w-full rounded-lg object-cover"
                  />
                )}
              </li>
            ))}
          </ol>
        )}
      </Card>

      {/* Customize (collapsed) */}
      <Card className="overflow-hidden">
        <button
          onClick={() => setEditOpen((v) => !v)}
          className="flex w-full items-center justify-between p-4 transition-colors hover:bg-muted/40"
        >
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Palette className="h-4 w-4" />
            Customize profile
          </div>
          <ChevronDown
            className={cn(
              "h-4 w-4 transition-transform",
              editOpen && "rotate-180",
            )}
          />
        </button>
        {editOpen && (
          <div className="space-y-5 border-t border-border p-5">
            <div>
              <Label>Avatar photo</Label>
              <div className="mt-2">
                <PhotoUpload
                  value={form.avatarUrl}
                  onChange={(p) => setForm({ ...form, avatarUrl: p })}
                  capture={false}
                />
              </div>
            </div>

            <div>
              <Label>Display name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="mt-1 rounded-lg"
                placeholder="Jordan Rep"
              />
            </div>

            <div>
              <Label className="flex items-center gap-2">
                <Palette className="h-4 w-4" /> Accent color
              </Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {PALETTE.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Pick color ${c}`}
                    onClick={() => setForm({ ...form, accentColor: c })}
                    className={cn(
                      "h-9 w-9 rounded-md border-2 transition-transform",
                      form.accentColor === c
                        ? "scale-105 border-foreground/80"
                        : "border-border hover:scale-105 hover:border-foreground/30",
                    )}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Hometown</Label>
                <Input
                  value={form.hometown}
                  onChange={(e) => setForm({ ...form, hometown: e.target.value })}
                  placeholder="Fort Myers, FL"
                  className="mt-1 rounded-lg"
                />
              </div>
              <div>
                <Label>Favorite service line</Label>
                <select
                  value={form.favoriteService}
                  onChange={(e) =>
                    setForm({ ...form, favoriteService: e.target.value })
                  }
                  className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#3DA935]/30"
                >
                  <option value="">—</option>
                  {SERVICE_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <Label>Big-trip goal</Label>
              <Input
                value={form.hawaiiGoal}
                onChange={(e) => setForm({ ...form, hawaiiGoal: e.target.value })}
                placeholder="Surfing the North Shore in December"
                maxLength={140}
                className="mt-1 rounded-lg"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                What you're chasing for the top-tier trip prize.
              </p>
            </div>

            <div>
              <Label>Bio</Label>
              <Textarea
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
                placeholder="Born and raised in SWFL. Climber turned closer."
                maxLength={280}
                className="mt-1 min-h-[88px] rounded-lg"
              />
            </div>

            <div className="flex justify-end">
              <Button
                onClick={save}
                disabled={update.isPending}
                className="rounded-lg bg-[#3DA935] text-slate-950 hover:bg-[#4FBF45]"
              >
                <Save className="mr-2 h-4 w-4" />
                {update.isPending ? "Saving…" : "Save profile"}
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function StatTile({
  icon,
  label,
  value,
  color,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  color: string;
  sub?: string;
}) {
  return (
    <Card className="group relative overflow-hidden p-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-20 blur-2xl"
        style={{ background: color }}
      />
      <div className="relative flex items-center gap-2">
        <span
          className="flex h-7 w-7 items-center justify-center rounded-lg"
          style={{ background: `${color}22`, color }}
        >
          <span className="h-3.5 w-3.5">{icon}</span>
        </span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
      </div>
      <div
        className="font-stat mt-1 text-2xl font-extrabold tabular-nums"
        style={{ color: typeof value === "number" ? undefined : color }}
      >
        {typeof value === "number" ? (
          <AnimatedNumber value={value} />
        ) : (
          value
        )}
      </div>
      {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
    </Card>
  );
}

// Lucide icons render at <Star size={...}/>; we wrap in spans to control sizing.
// Re-export specific icons used inline above so the tree-shake remains stable.
void Star;
