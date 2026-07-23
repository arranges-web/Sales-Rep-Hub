import {
  useListRewards,
  useCreateRedemption,
  useListRedemptions,
  useGetMe,
  getListRedemptionsQueryKey,
  getGetMeQueryKey,
  type Reward,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Gift,
  Lock,
  Sparkles,
  Heart,
  Trophy,
  Flame,
  CheckCircle2,
  XCircle,
  Clock,
  Star,
  Crown,
  Zap,
  ArrowRight,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCelebrate } from "@/hooks/useCelebrate";
import { BrandHeader } from "@/components/BrandHeader";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { JTSkeletonCard } from "@/components/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { useEffect, useMemo, useRef, useState } from "react";

const CATEGORY_ACCENT: Record<string, string> = {
  gear: "#3DA935",
  tools: "#f97316",
  sports: "#ef4444",
  electronics: "#a855f7",
  experiences: "#ec4899",
  trip: "#FFBF00",
  pto: "#7ed85c",
  cash: "#2C8214",
  other: "#94a3b8",
};

const CATEGORY_LABEL: Record<string, string> = {
  gear: "Gear",
  tools: "Tools",
  sports: "Sports",
  electronics: "Tech",
  experiences: "Experiences",
  trip: "Trips",
  pto: "PTO",
  cash: "Cash",
  other: "Other",
};

// Earned-points tier ladder. Drives the "status" feel — the rep is a
// Bronze closer at 0, becomes Platinum at 25k earned.
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
  for (const t of TIERS) {
    if (points >= t.min) tier = t;
  }
  const nextTier =
    tier.next == null ? null : (TIERS.find((t) => t.min === tier.next) ?? null);
  const span = tier.next == null ? 1 : tier.next - tier.min;
  const progress = tier.next == null ? 1 : Math.min(1, (points - tier.min) / span);
  return { tier, nextTier, progress };
}

const WISHLIST_KEY = "jt:rewards:wishlist";

function loadWishlist(): Set<number> {
  try {
    const raw = localStorage.getItem(WISHLIST_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((n): n is number => typeof n === "number"));
  } catch {
    return new Set();
  }
}

function saveWishlist(set: Set<number>) {
  try {
    localStorage.setItem(WISHLIST_KEY, JSON.stringify(Array.from(set)));
  } catch {
    /* ignore quota */
  }
}

export default function RewardsPage() {
  const qc = useQueryClient();
  const { data: me } = useGetMe();
  const { data: rewards } = useListRewards();
  const { data: redemptions } = useListRedemptions();
  const { toast } = useToast();
  const celebrate = useCelebrate();
  const create = useCreateRedemption();

  const myPoints = me?.totalPoints ?? 0;
  const [filter, setFilter] = useState<string>("all");
  const [wish, setWish] = useState<Set<number>>(() => new Set());

  useEffect(() => setWish(loadWishlist()), []);

  const toggleWish = (id: number) =>
    setWish((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      saveWishlist(next);
      return next;
    });

  // Toast + confetti when a previously-pending redemption gets approved
  const seenStatusRef = useRef<Map<number, string>>(new Map());
  useEffect(() => {
    if (!redemptions) return;
    const seen = seenStatusRef.current;
    for (const r of redemptions) {
      const prev = seen.get(r.id);
      if (prev && prev !== r.status && r.status === "approved") {
        celebrate.redemptionApproved(r.rewardName);
      }
      seen.set(r.id, r.status);
    }
  }, [redemptions, celebrate]);

  const { tier, nextTier, progress } = tierFor(myPoints);
  const TierIcon = tier.icon;

  const sortedRewards = useMemo(
    () =>
      [...(rewards ?? [])].sort((a, b) => {
        // Affordable & in-stock first, then by cost ascending. So the rep
        // sees "what can I redeem RIGHT NOW" up top.
        const aAfford = a.available && myPoints >= a.pointCost ? 0 : 1;
        const bAfford = b.available && myPoints >= b.pointCost ? 0 : 1;
        if (aAfford !== bAfford) return aAfford - bAfford;
        return a.pointCost - b.pointCost;
      }),
    [rewards, myPoints],
  );

  const filtered = useMemo(
    () =>
      filter === "all"
        ? sortedRewards
        : sortedRewards.filter((r) => r.category === filter),
    [sortedRewards, filter],
  );

  // Featured reward = highest cost (the aspirational one). Falls back if absent.
  const featured = useMemo(
    () =>
      (rewards ?? [])
        .filter((r) => r.available)
        .sort((a, b) => b.pointCost - a.pointCost)[0] ?? null,
    [rewards],
  );

  // Nearest affordable target — points until the next reward unlocks.
  const nextUnlock = useMemo(() => {
    const locked = (rewards ?? [])
      .filter((r) => r.available && r.pointCost > myPoints)
      .sort((a, b) => a.pointCost - b.pointCost);
    return locked[0] ?? null;
  }, [rewards, myPoints]);

  const categoryCounts = useMemo(() => {
    const out = new Map<string, number>();
    for (const r of rewards ?? []) out.set(r.category, (out.get(r.category) ?? 0) + 1);
    return out;
  }, [rewards]);

  const affordableCount = (rewards ?? []).filter(
    (r) => r.available && myPoints >= r.pointCost,
  ).length;

  const handleRedeem = async (r: Reward) => {
    try {
      await create.mutateAsync({ data: { rewardId: r.id } });
      toast({
        title: "Redemption requested",
        description: `${r.name} — an admin will review your request.`,
      });
      qc.invalidateQueries({ queryKey: getListRedemptionsQueryKey() });
      qc.invalidateQueries({ queryKey: getGetMeQueryKey() });
    } catch (e) {
      toast({
        title: "Could not redeem",
        description: String(e),
        variant: "destructive",
      });
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
      <BrandHeader
        title="The Vault"
        subtitle="Cash your points for gear, trips, and bragging rights."
        icon={<Gift className="h-6 w-6 text-[#FFBF00]" strokeWidth={1.5} />}
        accent="#FFBF00"
      />

      {/* Cinematic hero — balance, tier, progress to next */}
      <Card className="relative isolate overflow-hidden border-border/80 p-0">
        {/* Background layers */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#FFBF00]/15 via-transparent to-[#3DA935]/15"
        />
        <div
          aria-hidden
          className="jt-orbit pointer-events-none absolute -right-32 -top-32 h-80 w-80 rounded-full bg-[#FFBF00]/30 opacity-50 blur-3xl"
        />
        <div
          aria-hidden
          className="jt-orbit pointer-events-none absolute -left-24 -bottom-32 h-72 w-72 rounded-full bg-[#3DA935]/30 opacity-40 blur-3xl"
          style={{ animationDelay: "2s" }}
        />
        <div aria-hidden className="jt-sparkles" />

        <div className="relative grid gap-6 p-5 sm:p-7 md:grid-cols-[1.4fr_1fr]">
          {/* Left: balance + tier */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-[#FFBF00]" />
              Your balance
            </div>
            <div className="flex items-baseline gap-2">
              <AnimatedNumber
                value={myPoints}
                className="jt-brand-gradient font-stat text-6xl font-extrabold tracking-tight tabular-nums sm:text-7xl"
              />
              <span className="text-base font-bold text-muted-foreground">pts</span>
            </div>

            {/* Tier strip */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3 text-xs">
                <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-2.5 py-1">
                  <span
                    className="inline-flex h-5 w-5 items-center justify-center rounded-full"
                    style={{
                      background: `${tier.color}30`,
                      color: tier.color,
                    }}
                  >
                    <TierIcon className="h-3 w-3" strokeWidth={2.5} />
                  </span>
                  <span className="font-bold uppercase tracking-wider">
                    {tier.label} closer
                  </span>
                </div>
                {nextTier ? (
                  <span className="text-[11px] text-muted-foreground">
                    <span className="font-stat font-bold text-foreground tabular-nums">
                      {(nextTier.min - myPoints).toLocaleString()}
                    </span>{" "}
                    pts to {nextTier.label}
                  </span>
                ) : (
                  <span className="font-bold text-[#FFBF00]">Top tier — untouchable.</span>
                )}
              </div>
              <div className="relative h-2 overflow-hidden rounded-full bg-foreground/10">
                <div
                  className="h-full rounded-full transition-[width] duration-700"
                  style={{
                    width: `${Math.round(progress * 100)}%`,
                    background: `linear-gradient(90deg, ${tier.color}, ${
                      nextTier?.color ?? tier.color
                    })`,
                    boxShadow: `0 0 14px ${tier.color}80`,
                  }}
                />
              </div>
            </div>

            {/* Quick stats */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Stat
                color="#2C8214"
                label="Can redeem now"
                value={affordableCount}
                icon={<Zap className="h-3 w-3" strokeWidth={2.5} />}
              />
              {nextUnlock && (
                <Stat
                  color="#3DA935"
                  label={`Next unlock — ${nextUnlock.name}`}
                  value={`${(nextUnlock.pointCost - myPoints).toLocaleString()} pts`}
                  icon={<Lock className="h-3 w-3" strokeWidth={2.5} />}
                />
              )}
              <Stat
                color="#FFBF00"
                label="Wishlisted"
                value={wish.size}
                icon={<Heart className="h-3 w-3" strokeWidth={2.5} />}
              />
            </div>
          </div>

          {/* Right: featured aspiration card */}
          {featured && (
            <button
              onClick={() => {
                const el = document.getElementById(`reward-${featured.id}`);
                el?.scrollIntoView({ behavior: "smooth", block: "center" });
              }}
              className="group relative isolate flex flex-col overflow-hidden rounded-2xl border border-[#FFBF00]/40 bg-card/60 p-4 text-left transition-all duration-300 hover:-translate-y-0.5 hover:border-[#FFBF00]/80"
              title="Featured prize"
            >
              <div
                aria-hidden
                className="pointer-events-none absolute -right-6 -top-6 h-32 w-32 rounded-full bg-[#FFBF00]/30 blur-2xl transition-opacity group-hover:opacity-100"
              />
              <div className="relative flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#FFBF00]">
                <Flame className="h-3.5 w-3.5" />
                Featured prize
              </div>
              {featured.imageUrl ? (
                <div
                  className="jt-shine relative mt-3 h-28 w-full overflow-hidden rounded-xl"
                  style={{ background: `url(${featured.imageUrl}) center/cover` }}
                >
                  <div className="absolute inset-0 bg-gradient-to-t from-card/80 to-transparent" />
                </div>
              ) : (
                <div
                  className="mt-3 h-28 w-full rounded-xl"
                  style={{
                    background: `linear-gradient(135deg, ${
                      CATEGORY_ACCENT[featured.category] ?? "#FFBF00"
                    }60, transparent)`,
                  }}
                />
              )}
              <div className="relative mt-3 flex-1 space-y-1">
                <h3 className="text-lg font-extrabold leading-tight">
                  {featured.name}
                </h3>
                <p className="line-clamp-2 text-xs text-muted-foreground">
                  {featured.description}
                </p>
              </div>
              <div className="relative mt-3 flex items-end justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Cost
                  </div>
                  <div className="font-stat text-2xl font-extrabold tabular-nums text-[#FFBF00]">
                    {featured.pointCost.toLocaleString()}
                    <span className="ml-1 text-xs font-medium text-muted-foreground">
                      pts
                    </span>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#FFBF00] transition-transform group-hover:translate-x-0.5">
                  See in vault <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </button>
          )}
        </div>
      </Card>

      {/* Category filter */}
      <div className="flex flex-wrap gap-1.5">
        <Pill
          active={filter === "all"}
          onClick={() => setFilter("all")}
          accent="#FFBF00"
        >
          All
          <span className="ml-1 inline-flex items-center justify-center rounded bg-foreground/10 px-1 text-[10px] font-bold">
            {rewards?.length ?? 0}
          </span>
        </Pill>
        {Array.from(categoryCounts.entries()).map(([cat, count]) => {
          const accent = CATEGORY_ACCENT[cat] ?? "#3DA935";
          return (
            <Pill
              key={cat}
              active={filter === cat}
              onClick={() => setFilter(cat)}
              accent={accent}
            >
              {CATEGORY_LABEL[cat] ?? cat}
              <span className="ml-1 inline-flex items-center justify-center rounded bg-foreground/10 px-1 text-[10px] font-bold">
                {count}
              </span>
            </Pill>
          );
        })}
      </div>

      {/* Reward grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 jt-fade-in-stagger">
        {rewards == null &&
          Array.from({ length: 6 }).map((_, i) => (
            <JTSkeletonCard key={i} rows={3} />
          ))}
        {filtered.map((r) => (
          <RewardCard
            key={r.id}
            reward={r}
            myPoints={myPoints}
            wishlisted={wish.has(r.id)}
            redeeming={create.isPending}
            onToggleWish={() => toggleWish(r.id)}
            onRedeem={() => handleRedeem(r)}
          />
        ))}
        {rewards && filtered.length === 0 && (
          <div className="col-span-full">
            <EmptyState
              title={
                filter === "all"
                  ? "The vault is empty"
                  : `No ${CATEGORY_LABEL[filter] ?? filter} prizes`
              }
              description={
                filter === "all"
                  ? "Ask your admin to stock prizes — gear, tickets, the top-tier trip."
                  : "Try another category."
              }
              icon={<Gift className="h-6 w-6" strokeWidth={1.5} />}
            />
          </div>
        )}
      </div>

      {/* Redemption history */}
      {(redemptions?.length ?? 0) > 0 && (
        <Card className="relative overflow-hidden p-5">
          <div className="mb-4 flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-base font-bold tracking-tight">Your redemptions</h2>
            <span className="ml-auto text-xs text-muted-foreground">
              {redemptions!.length} total
            </span>
          </div>
          <ol className="relative space-y-3 border-l border-border pl-5">
            {redemptions!.map((r) => {
              const tone =
                r.status === "approved"
                  ? { c: "#2C8214", Icon: CheckCircle2 }
                  : r.status === "rejected"
                    ? { c: "#f87171", Icon: XCircle }
                    : { c: "#FFBF00", Icon: Clock };
              const Icon = tone.Icon;
              return (
                <li key={r.id} className="relative">
                  <span
                    className="absolute -left-[26px] top-1.5 flex h-4 w-4 items-center justify-center rounded-full"
                    style={{ background: `${tone.c}30`, color: tone.c }}
                    aria-hidden
                  >
                    <Icon className="h-3 w-3" strokeWidth={2.5} />
                  </span>
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-background/40 p-3">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{r.rewardName}</div>
                      <div className="font-stat mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                        <span>
                          {formatDistanceToNow(new Date(r.createdAt), {
                            addSuffix: true,
                          })}
                        </span>
                        <span>·</span>
                        <span>{r.pointCost.toLocaleString()} pts</span>
                      </div>
                    </div>
                    <Badge
                      className="rounded-full border-0 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                      style={{ color: tone.c, background: `${tone.c}20` }}
                    >
                      {r.status}
                    </Badge>
                  </div>
                </li>
              );
            })}
          </ol>
        </Card>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: number | string;
  color: string;
  icon?: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/40 px-2.5 py-1 text-xs">
      <span
        className="inline-flex h-4 w-4 items-center justify-center rounded-full"
        style={{ background: `${color}25`, color }}
      >
        {icon}
      </span>
      <span className="text-muted-foreground">{label}</span>
      <span
        className="font-stat font-bold tabular-nums"
        style={{ color }}
      >
        {value}
      </span>
    </span>
  );
}

function Pill({
  active,
  onClick,
  accent = "#3DA935",
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
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all duration-200",
        active
          ? "border-transparent text-slate-950 shadow-md"
          : "border-border bg-background/50 text-foreground/80 hover:bg-muted",
      )}
      style={active ? { background: accent, boxShadow: `0 6px 18px -8px ${accent}` } : undefined}
    >
      {children}
    </button>
  );
}

function RewardCard({
  reward: r,
  myPoints,
  wishlisted,
  redeeming,
  onToggleWish,
  onRedeem,
}: {
  reward: Reward;
  myPoints: number;
  wishlisted: boolean;
  redeeming: boolean;
  onToggleWish: () => void;
  onRedeem: () => void;
}) {
  const accent = CATEGORY_ACCENT[r.category] ?? "#3DA935";
  const canAfford = r.available && myPoints >= r.pointCost;
  const shortBy = r.pointCost - myPoints;
  const closeToGoal = !canAfford && shortBy > 0 && shortBy <= 500;
  const lowStock = r.stock != null && r.stock > 0 && r.stock <= 3;
  const outOfStock = r.stock != null && r.stock <= 0;
  const progress = Math.min(1, myPoints / Math.max(1, r.pointCost));

  return (
    <Card
      id={`reward-${r.id}`}
      className={cn(
        "group relative isolate flex flex-col overflow-hidden border-border bg-card transition-all duration-300",
        "hover:-translate-y-1 hover:border-[#3DA935]/40",
        canAfford && "hover:shadow-[0_24px_50px_-20px_rgba(44,130,20,0.6)]",
        !canAfford &&
          "hover:shadow-[0_18px_40px_-20px_rgba(61,169,53,0.45)]",
      )}
    >
      {/* Hover shine sweep */}
      <div aria-hidden className="jt-shine pointer-events-none absolute inset-0 z-[1]" />

      {/* Image / gradient */}
      <div className="relative h-36 w-full overflow-hidden">
        <div
          className={cn(
            "absolute inset-0 transition-transform duration-500 group-hover:scale-[1.04]",
            !canAfford && "grayscale-[35%]",
          )}
          style={{
            background: r.imageUrl
              ? `url(${r.imageUrl}) center/cover`
              : `linear-gradient(135deg, ${accent}55, transparent 75%)`,
          }}
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-card via-card/40 to-transparent" />

        {/* Category chip */}
        <span
          className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider backdrop-blur"
          style={{
            color: accent,
            borderColor: `${accent}66`,
            background: `${accent}22`,
          }}
        >
          {CATEGORY_LABEL[r.category] ?? r.category}
        </span>

        {/* Affordable / state ribbon */}
        {canAfford && (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-[#2C8214] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-md">
            <Zap className="h-3 w-3" strokeWidth={2.5} /> Unlocked
          </span>
        )}
        {!canAfford && closeToGoal && (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-[#FFBF00] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-950 shadow-md">
            <Flame className="h-3 w-3" strokeWidth={2.5} /> Almost
          </span>
        )}
        {lowStock && (
          <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full bg-slate-950/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300 backdrop-blur">
            Only {r.stock} left
          </span>
        )}

        {/* Wishlist heart */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleWish();
          }}
          className={cn(
            "absolute bottom-3 right-3 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/15 backdrop-blur transition-colors",
            wishlisted
              ? "bg-[#FFBF00] text-slate-950 hover:bg-[#ffcd33]"
              : "bg-slate-950/55 text-white hover:bg-slate-950/80",
          )}
          title={wishlisted ? "Remove from wishlist" : "Save to wishlist"}
          aria-label={wishlisted ? "Remove from wishlist" : "Save to wishlist"}
        >
          <Heart
            className="h-4 w-4"
            fill={wishlisted ? "currentColor" : "none"}
            strokeWidth={2.25}
          />
        </button>
      </div>

      <div className="relative z-[2] flex flex-1 flex-col p-4">
        <h3 className="text-base font-extrabold leading-tight">{r.name}</h3>
        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
          {r.description}
        </p>

        {/* Cost + progress bar */}
        <div className="mt-4 space-y-2">
          <div className="flex items-baseline justify-between gap-2">
            <div>
              <span
                className={cn(
                  "font-stat text-2xl font-extrabold tabular-nums",
                  canAfford && "text-[#FFBF00]",
                )}
                style={!canAfford ? { color: "var(--foreground)" } : undefined}
              >
                {r.pointCost.toLocaleString()}
              </span>
              <span className="ml-1 text-xs font-medium text-muted-foreground">
                pts
              </span>
            </div>
            {!canAfford && shortBy > 0 && (
              <span className="text-[11px] text-muted-foreground">
                <span className="font-stat font-bold text-foreground tabular-nums">
                  {shortBy.toLocaleString()}
                </span>{" "}
                pts to go
              </span>
            )}
          </div>
          {!canAfford && (
            <div className="h-1.5 overflow-hidden rounded-full bg-foreground/10">
              <div
                className="h-full rounded-full transition-[width] duration-700"
                style={{
                  width: `${Math.round(progress * 100)}%`,
                  background: closeToGoal
                    ? "linear-gradient(90deg, #FFBF00, #ff7a2d)"
                    : `linear-gradient(90deg, ${accent}, #3DA935)`,
                  boxShadow: closeToGoal ? "0 0 10px #FFBF0080" : undefined,
                }}
              />
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center gap-2">
          {outOfStock ? (
            <Button disabled className="w-full rounded-xl" variant="outline">
              Out of stock
            </Button>
          ) : canAfford ? (
            <Button
              onClick={onRedeem}
              disabled={redeeming}
              className="jt-gold-pulse w-full rounded-xl bg-gradient-to-r from-[#2C8214] to-[#34a019] font-semibold text-white shadow-lg shadow-[#2C8214]/30 hover:from-[#34a019] hover:to-[#3eb31e]"
            >
              <Gift className="mr-1.5 h-4 w-4" />
              Redeem now
            </Button>
          ) : (
            <Button
              disabled
              variant="outline"
              className="w-full rounded-xl gap-1"
            >
              <Lock className="h-3.5 w-3.5" />
              Locked
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
