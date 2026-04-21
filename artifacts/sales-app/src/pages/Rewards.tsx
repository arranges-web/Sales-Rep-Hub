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

export default function RewardsPage() {
  const qc = useQueryClient();
  const { data: me } = useGetMe();
  const { data: rewards } = useListRewards();
  const { data: redemptions } = useListRedemptions();
  const { toast } = useToast();
  const create = useCreateRedemption();

  const myPoints = me?.totalPoints ?? 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Incentive Vault 🎁</h1>
          <p className="mt-1 text-muted-foreground">Trade your points for rewards.</p>
        </div>
        <Card className="flex items-center gap-3 bg-gradient-to-r from-[#FFBF00] to-[#ffdb66] px-5 py-3 shadow-md">
          <Gift className="h-5 w-5 text-slate-900" />
          <div>
            <div className="text-xs font-medium text-slate-800">Your balance</div>
            <div className="text-xl font-extrabold text-slate-900 tabular-nums">{myPoints.toLocaleString()} pts</div>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(rewards ?? []).map((r) => {
          const canAfford = myPoints >= r.pointCost && r.available;
          return (
            <Card key={r.id} className="overflow-hidden flex flex-col">
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
          <Card className="col-span-full p-8 text-center text-sm text-muted-foreground">
            No rewards have been added yet. Ask your admin to stock the vault!
          </Card>
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
