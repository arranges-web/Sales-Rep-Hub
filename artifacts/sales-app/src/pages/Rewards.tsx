import {
  useListRewards,
  useCreateRedemption,
  useListRedemptions,
  useGetMe,
  getListRedemptionsQueryKey,
  getGetMeQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Gift, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCelebrate } from "@/hooks/useCelebrate";
import { BrandHeader } from "@/components/BrandHeader";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { JTSkeletonCard } from "@/components/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import { useEffect, useRef } from "react";

const CATEGORY_ACCENT: Record<string, string> = {
  gear: "#2EA3F2",
  tools: "#f97316",
  sports: "#ef4444",
  electronics: "#a855f7",
  experiences: "#ec4899",
  trip: "#FFBF00",
  pto: "#7ed85c",
  cash: "#2C8214",
  other: "#94a3b8",
};

export default function RewardsPage() {
  const qc = useQueryClient();
  const { data: me } = useGetMe();
  const { data: rewards } = useListRewards();
  const { data: redemptions } = useListRedemptions();
  const { toast } = useToast();
  const celebrate = useCelebrate();
  const create = useCreateRedemption();

  const myPoints = me?.totalPoints ?? 0;

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

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6 lg:p-8">
      <BrandHeader
        title="The Vault"
        subtitle="Cash points for gear, tickets, and trips."
        icon={<Gift className="h-6 w-6 text-[#FFBF00]" strokeWidth={1.5} />}
        accent="#FFBF00"
        actions={
          <div className="inline-flex items-center gap-2 rounded-lg border border-[#FFBF00]/40 bg-[#FFBF00]/10 px-3 py-1.5">
            <Gift className="h-4 w-4 text-[#FFBF00]" />
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Balance
              </div>
              <AnimatedNumber
                value={myPoints}
                className="font-stat block text-base font-extrabold leading-tight text-[#FFBF00]"
              />
            </div>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 jt-fade-in-stagger">
        {rewards == null &&
          Array.from({ length: 6 }).map((_, i) => (
            <JTSkeletonCard key={i} rows={3} />
          ))}
        {(rewards ?? []).map((r) => {
          const canAfford = myPoints >= r.pointCost && r.available;
          const accent = CATEGORY_ACCENT[r.category] ?? "#2EA3F2";
          return (
            <Card key={r.id} className="jt-card-hover overflow-hidden flex flex-col border-border bg-card">
              <div className="relative h-32 w-full overflow-hidden">
                <div
                  className="absolute inset-0"
                  style={{
                    background: r.imageUrl
                      ? `url(${r.imageUrl}) center/cover`
                      : `linear-gradient(135deg, ${accent}40, transparent)`,
                  }}
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-card to-transparent opacity-90" />
                <span
                  className="font-stat absolute left-3 top-3 rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em]"
                  style={{
                    color: accent,
                    borderColor: `${accent}66`,
                    background: `${accent}22`,
                    backdropFilter: "blur(8px)",
                  }}
                >
                  {r.category}
                </span>
              </div>
              <div className="flex flex-1 flex-col p-4">
                <h3 className="font-bold text-foreground">{r.name}</h3>
                <p className="mt-1 flex-1 text-sm text-muted-foreground">{r.description}</p>
                <div className="mt-3 flex items-center justify-between">
                  <div className="font-stat text-2xl font-extrabold text-foreground">
                    {r.pointCost.toLocaleString()}{" "}
                    <span className="text-xs font-medium text-muted-foreground">pts</span>
                  </div>
                  <Button
                    size="sm"
                    disabled={!canAfford || create.isPending}
                    onClick={async () => {
                      try {
                        await create.mutateAsync({ data: { rewardId: r.id } });
                        toast({ title: "Redemption requested", description: "An admin will review your request." });
                        qc.invalidateQueries({ queryKey: getListRedemptionsQueryKey() });
                        qc.invalidateQueries({ queryKey: getGetMeQueryKey() });
                      } catch (e) {
                        toast({ title: "Could not redeem", description: String(e), variant: "destructive" });
                      }
                    }}
                    className={
                      canAfford
                        ? "rounded-lg bg-[#2C8214] text-white hover:bg-[#34a019]"
                        : "rounded-lg"
                    }
                    variant={canAfford ? "default" : "outline"}
                  >
                    {canAfford ? "Redeem" : <><Lock className="mr-1 h-3.5 w-3.5" /> Locked</>}
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
        {rewards && rewards.length === 0 && (
          <div className="col-span-full">
            <EmptyState
              title="The vault is empty"
              description="Ask your admin to stock prizes — gear, tickets, the top-tier trip."
              icon={<Gift className="h-6 w-6" strokeWidth={1.5} />}
            />
          </div>
        )}
      </div>

      <Card className="border-border bg-card p-5">
        <h2 className="mb-3 text-base font-bold tracking-tight">Your Redemption History</h2>
        <div className="space-y-2">
          {(redemptions ?? []).map((r) => {
            const tone =
              r.status === "approved"
                ? { c: "#2C8214", bg: "#2C821415" }
                : r.status === "rejected"
                  ? { c: "#f87171", bg: "#f8717115" }
                  : { c: "#FFBF00", bg: "#FFBF0015" };
            return (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-lg border border-border bg-background/40 p-3"
              >
                <div>
                  <div className="font-semibold">{r.rewardName}</div>
                  <div className="font-stat text-xs text-muted-foreground">
                    {new Date(r.createdAt).toLocaleString()} · {r.pointCost} pts
                  </div>
                </div>
                <span
                  className="font-stat rounded border px-2 py-0.5 text-[10px] font-bold uppercase"
                  style={{ color: tone.c, borderColor: `${tone.c}66`, background: tone.bg }}
                >
                  {r.status}
                </span>
              </div>
            );
          })}
          {redemptions && redemptions.length === 0 && (
            <p className="text-sm text-muted-foreground">No redemptions yet.</p>
          )}
        </div>
      </Card>
    </div>
  );
}
