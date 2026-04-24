import { useState } from "react";
import {
  useListDeals,
  useCreateDeal,
  useUpdateDeal,
  useDeleteDeal,
  useListPointConfigs,
  useGetMe,
  getListDealsQueryKey,
  getGetMeQueryKey,
  getGetLeaderboardQueryKey,
  getListFeedPostsQueryKey,
  getListBadgesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  CreateDealBodyServiceType,
  CreateDealBodyStatus,
  DealStatus,
} from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Briefcase, Plus, CheckCircle2, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCelebrate } from "@/hooks/useCelebrate";
import { BrandHeader } from "@/components/BrandHeader";
import { JTSkeletonRow } from "@/components/Skeleton";
import { EmptyState } from "@/components/EmptyState";

const SERVICE_OPTIONS: { value: CreateDealBodyServiceType; label: string }[] = [
  { value: "large_removal", label: "Large Removal" },
  { value: "trimming_pruning", label: "Trimming / Pruning" },
  { value: "stump_grinding", label: "Stump Grinding" },
  { value: "other", label: "Other" },
];

export default function DealsPage() {
  const qc = useQueryClient();
  const { data: deals } = useListDeals();
  const { data: configs } = useListPointConfigs();
  const create = useCreateDeal();
  const update = useUpdateDeal();
  const remove = useDeleteDeal();
  const { data: me } = useGetMe();
  const { toast } = useToast();
  const celebrate = useCelebrate();

  const handleDealResponse = (
    res: { pointsAwarded?: number; status?: string; customerName?: string; newBadges?: { label: string; description: string }[] | null; levelBefore?: number | null; levelAfter?: number | null },
  ) => {
    const closed = res.status === "closed" || res.status === "paid";
    if (closed && (res.pointsAwarded ?? 0) > 0) {
      celebrate.dealClosed({
        pointsAwarded: res.pointsAwarded ?? 0,
        customerName: res.customerName,
      });
    }
    if (res.newBadges && res.newBadges.length > 0) {
      // Stagger badge celebrations slightly so they're visible.
      res.newBadges.forEach((b, i) => {
        setTimeout(
          () => celebrate.badgeEarned({ label: b.label, description: b.description }),
          400 + i * 600,
        );
      });
    }
    if (
      res.levelBefore != null &&
      res.levelAfter != null &&
      res.levelAfter > res.levelBefore
    ) {
      setTimeout(() => celebrate.levelUp({ levelAfter: res.levelAfter! }), 900);
    }
  };
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{
    customerName: string;
    address: string;
    serviceType: CreateDealBodyServiceType | "";
    amount: number;
    notes: string;
    status: CreateDealBodyStatus;
  }>({
    customerName: "",
    address: "",
    serviceType: "",
    amount: 0,
    notes: "",
    status: "lead",
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: getListDealsQueryKey() });
    qc.invalidateQueries({ queryKey: getGetMeQueryKey() });
    qc.invalidateQueries({ queryKey: getGetLeaderboardQueryKey() });
    qc.invalidateQueries({ queryKey: getListFeedPostsQueryKey() });
    qc.invalidateQueries({ queryKey: getListBadgesQueryKey() });
  };

  const labelFor = (st: string) =>
    configs?.find((c) => c.serviceType === st)?.label ??
    SERVICE_OPTIONS.find((o) => o.value === st)?.label ??
    st;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6 lg:p-8">
      <Dialog open={open} onOpenChange={setOpen}>
        <BrandHeader
          title="My Deals"
          subtitle="Log every job. Close a deal to lock in points and badges."
          icon={<Briefcase className="h-6 w-6" strokeWidth={1.5} />}
          actions={
            <DialogTrigger asChild>
              <Button className="rounded-lg bg-[#2EA3F2] text-slate-950 hover:bg-[#48b3f6]">
                <Plus className="mr-1 h-4 w-4" /> New Deal
              </Button>
            </DialogTrigger>
          }
        />
          <DialogContent className="rounded-xl">
            <DialogHeader>
              <DialogTitle>New deal</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Customer name</Label>
                <Input value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} className="rounded-lg" />
              </div>
              <div>
                <Label>Address</Label>
                <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="rounded-lg" />
              </div>
              <div>
                <Label>Service type</Label>
                <Select
                  value={form.serviceType}
                  onValueChange={(v) => setForm({ ...form, serviceType: v as CreateDealBodyServiceType })}
                >
                  <SelectTrigger className="rounded-lg">
                    <SelectValue placeholder="Select service" />
                  </SelectTrigger>
                  <SelectContent>
                    {SERVICE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {labelFor(o.value)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Amount ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
                  className="rounded-lg font-stat"
                />
              </div>
              <div>
                <Label>Status</Label>
                <div className="mt-1 flex gap-2">
                  {(["lead", "closed"] as const).map((s) => (
                    <Button
                      key={s}
                      type="button"
                      variant={form.status === s ? "default" : "outline"}
                      onClick={() => setForm({ ...form, status: s })}
                      className="rounded-lg capitalize"
                    >
                      {s === "lead" ? "Open" : "Closed"}
                    </Button>
                  ))}
                </div>
              </div>
              <Button
                className="w-full rounded-lg bg-[#2EA3F2] text-slate-950 hover:bg-[#48b3f6]"
                onClick={async () => {
                  if (!form.customerName || !form.serviceType || form.amount <= 0) {
                    toast({ title: "Missing info", description: "Customer, service, and amount are required.", variant: "destructive" });
                    return;
                  }
                  const res = await create.mutateAsync({
                    data: {
                      customerName: form.customerName,
                      address: form.address,
                      serviceType: form.serviceType,
                      amount: form.amount,
                      notes: form.notes || null,
                      status: form.status,
                    },
                  });
                  invalidateAll();
                  setForm({ customerName: "", address: "", serviceType: "", amount: 0, notes: "", status: "lead" });
                  setOpen(false);
                  if (form.status === "closed") {
                    handleDealResponse(res);
                  } else {
                    toast({ title: "Deal logged" });
                  }
                }}
              >
                Save deal
              </Button>
            </div>
          </DialogContent>
      </Dialog>

      <div className="space-y-2.5 jt-fade-in-stagger">
        {deals == null &&
          Array.from({ length: 4 }).map((_, i) => <JTSkeletonRow key={i} />)}
        {(deals ?? []).map((d) => {
          const isClosed: boolean = d.status === ("closed" as DealStatus) || d.status === ("paid" as DealStatus);
          const accentColor = isClosed ? "#2C8214" : "#2EA3F2";
          return (
            <Card key={d.id} className="jt-card-hover border-border bg-card p-4 jt-fade-in">
              <div className="flex items-start gap-4">
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border"
                  style={{
                    backgroundColor: `${accentColor}14`,
                    color: accentColor,
                  }}
                >
                  <Briefcase className="h-5 w-5" strokeWidth={1.75} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-semibold text-foreground">{d.customerName}</span>
                    <span
                      className="font-stat rounded border px-1.5 text-[10px] font-bold uppercase tracking-wide"
                      style={{
                        color: accentColor,
                        borderColor: `${accentColor}66`,
                        background: `${accentColor}14`,
                      }}
                    >
                      {d.status === "lead" ? "OPEN" : d.status}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {labelFor(d.serviceType)}{d.address ? ` · ${d.address}` : ""}
                  </div>
                  <div className="mt-1 text-sm">
                    <span className="font-stat font-semibold text-foreground">${d.amount.toLocaleString()}</span>
                    {" · "}
                    <span className="font-stat font-semibold text-[#2EA3F2]">{d.pointsAwarded} pts</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1 sm:flex-row">
                  {!isClosed && (
                    <Button
                      size="sm"
                      className="rounded-lg bg-[#2C8214] text-white hover:bg-[#34a019]"
                      onClick={async () => {
                        const res = await update.mutateAsync({
                          dealId: d.id,
                          data: { status: "closed" },
                        });
                        invalidateAll();
                        handleDealResponse(res);
                      }}
                    >
                      <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Close
                    </Button>
                  )}
                  {me?.role === "admin" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="rounded-lg"
                      onClick={async () => {
                        await remove.mutateAsync({ dealId: d.id });
                        invalidateAll();
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
        {deals && deals.length === 0 && (
          <EmptyState
            title="No deals yet"
            description="Hit New Deal to log your first job. Closed deals award points and badges instantly."
            icon={<Briefcase className="h-6 w-6" strokeWidth={1.5} />}
          />
        )}
      </div>
    </div>
  );
}
