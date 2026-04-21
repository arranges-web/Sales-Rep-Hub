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
import { Badge } from "@/components/ui/badge";
import { Gift, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCelebrate } from "@/hooks/useCelebrate";
import { BrandHeader } from "@/components/BrandHeader";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { JTSkeletonCard } from "@/components/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import { useEffect, useRef } from "react";

export default function RewardsPage() {
  const qc = useQueryClient();
  const { data: me } = useGetMe();
  const { data: rewards } = useListRewards();
  const { data: redemptions } = useListRedemptions();
  const { toast } = useToast();
  const celebrate = useCelebrate();
  const create = useCreateRedemption();

  const myPoints = me?.totalPoints ?? 0;

  // Surface celebration when a previously pending redemption flips to approved.
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
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
      <BrandHeader
        title="Incentive Vault"
        subtitle="Trade your points for rewards."
        icon={<Gift className="h-6 w-6" />}
        actions={
          <div className="flex items-center gap-2 rounded-2xl bg-[#FFBF00] px-4 py-2 text-slate-900 shadow-md">
            <Gift className="h-4 w-4" />
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wide opacity-80">
                Your balance
              </div>
              <AnimatedNumber
                value={myPoints}
                className="block text-lg font-extrabold tabular-nums leading-tight"
              />
            </div>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 jt-fade-in-stagger">
        {rewards == null &&
          Array.from({ length: 6 }).map((_, i) => (
            <JTSkeletonCard key={i} rows={3} />
          ))}
        {(rewards ?? []).map((r) => {
          const canAfford = myPoints >= r.pointCost && r.available;
          return (
            <Card key={r.id} className="overflow-hidden flex flex-col jt-tilt">
              <div
                className="h-32 w-full"
                style={{
                  background: r.imageUrl
                    ? `url(${r.imageUrl}) center/cover`
                    : "linear-gradient(135deg, #2EA3F2, #2C8214)",
                }}
              />
              <div className="flex flex-1 flex-col p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold">{r.name}</h3>
                  <Badge className="capitalize" variant="outline">{r.category}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{r.description}</p>
                <div className="mt-3 flex items-center justify-between">
                  <div className="text-2xl font-extrabold tabular-nums text-[#2EA3F2]">
                    {r.pointCost.toLocaleString()} <span className="text-xs font-medium text-muted-foreground">pts</span>
                  </div>
                  <Button
                    size="sm"
                    disabled={!canAfford || create.isPending}
                    onClick={async () => {
                      try {
                        await create.mutateAsync({ data: { rewardId: r.id } });
                        toast({ title: "Redemption requested!", description: "An admin will review your request." });
                        qc.invalidateQueries({ queryKey: getListRedemptionsQueryKey() });
                        qc.invalidateQueries({ queryKey: getGetMeQueryKey() });
                      } catch (e) {
                        toast({ title: "Could not redeem", description: String(e), variant: "destructive" });
                      }
                    }}
                    className="rounded-xl bg-[#2C8214] hover:bg-[#236812]"
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
              description="Ask your admin to stock rewards — gear, PTO, the Hawaii trip, and more."
              icon={<Gift className="h-7 w-7" />}
            />
          </div>
        )}
      </div>

      <Card className="p-4">
        <h2 className="mb-3 text-lg font-bold">Your Redemption History</h2>
        <div className="space-y-2">
          {(redemptions ?? []).map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded-xl border border-border p-3">
              <div>
                <div className="font-semibold">{r.rewardName}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(r.createdAt).toLocaleString()} • {r.pointCost} pts
                </div>
              </div>
              <Badge
                className={
                  r.status === "approved"
                    ? "bg-[#2C8214] text-white"
                    : r.status === "rejected"
                      ? "bg-red-500 text-white"
                      : "bg-[#FFBF00] text-slate-900"
                }
              >
                {r.status}
              </Badge>
            </div>
          ))}
          {redemptions && redemptions.length === 0 && (
            <p className="text-sm text-muted-foreground">No redemptions yet.</p>
          )}
        </div>
      </Card>
    </div>
  );
}
