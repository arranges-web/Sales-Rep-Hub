import { useState } from "react";
import {
  useListDeals,
  useCreateDeal,
  useUpdateDeal,
  useDeleteDeal,
  useListPointConfigs,
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
  const { toast } = useToast();
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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">My Deals 💼</h1>
          <p className="mt-1 text-muted-foreground">
            Log every job. Closing a deal awards points and badges.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-xl bg-[#2EA3F2] hover:bg-[#1d8fd8]">
              <Plus className="mr-1 h-4 w-4" /> New Deal
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-2xl">
            <DialogHeader>
              <DialogTitle>New deal</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Customer name</Label>
                <Input value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} />
              </div>
              <div>
                <Label>Address</Label>
                <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>
              <div>
                <Label>Service type</Label>
                <Select
                  value={form.serviceType}
                  onValueChange={(v) => setForm({ ...form, serviceType: v as CreateDealBodyServiceType })}
                >
                  <SelectTrigger className="rounded-xl">
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
                      className="rounded-xl capitalize"
                    >
                      {s === "lead" ? "Open" : "Closed"}
                    </Button>
                  ))}
                </div>
              </div>
              <Button
                className="w-full rounded-xl bg-[#2EA3F2] hover:bg-[#1d8fd8]"
                onClick={async () => {
                  if (!form.customerName || !form.serviceType || form.amount <= 0) {
                    toast({ title: "Missing info", description: "Customer, service, and amount are required.", variant: "destructive" });
                    return;
                  }
                  await create.mutateAsync({
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
                  toast({ title: form.status === "closed" ? "Deal closed! 🎉" : "Deal logged" });
                }}
              >
                Save deal
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {(deals ?? []).map((d) => {
          const isClosed: boolean = d.status === ("closed" as DealStatus) || d.status === ("paid" as DealStatus);
          return (
            <Card key={d.id} className="p-4">
              <div className="flex items-start gap-4">
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                  style={{
                    backgroundColor: isClosed ? "#2C821420" : "#2EA3F220",
                    color: isClosed ? "#2C8214" : "#2EA3F2",
                  }}
                >
                  <Briefcase className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold">{d.customerName}</span>
                    <Badge
                      className="text-white capitalize"
                      style={{ backgroundColor: isClosed ? "#2C8214" : "#2EA3F2" }}
                    >
                      {d.status === "lead" ? "Open" : d.status}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {labelFor(d.serviceType)}{d.address ? ` • ${d.address}` : ""}
                  </div>
                  <div className="mt-1 text-sm">
                    <span className="font-semibold tabular-nums">${d.amount.toLocaleString()}</span>
                    {" • "}
                    <span className="font-semibold text-[#2EA3F2] tabular-nums">{d.pointsAwarded} pts</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1 sm:flex-row">
                  {!isClosed && (
                    <Button
                      size="sm"
                      className="rounded-xl bg-[#2C8214] hover:bg-[#236812]"
                      onClick={async () => {
                        await update.mutateAsync({
                          dealId: d.id,
                          data: { status: "closed" },
                        });
                        invalidateAll();
                        toast({ title: "Deal closed! 🎉", description: "Points and badges updated." });
                      }}
                    >
                      <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Close
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="rounded-xl"
                    onClick={async () => {
                      await remove.mutateAsync({ dealId: d.id });
                      invalidateAll();
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
        {deals && deals.length === 0 && (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            No deals yet. Tap "New Deal" to log your first one!
          </Card>
        )}
      </div>
    </div>
  );
}
