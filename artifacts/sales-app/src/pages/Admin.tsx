import { useState } from "react";
import {
  useListUsers,
  useUpdateUser,
  useListIncentiveTiers,
  useCreateIncentiveTier,
  useDeleteIncentiveTier,
  useListPointConfigs,
  useCreatePointConfig,
  useUpdatePointConfig,
  useDeletePointConfig,
  useListRewards,
  useCreateReward,
  useUpdateReward,
  useDeleteReward,
  useListRedemptions,
  useUpdateRedemption,
  useListTrainingResources,
  useCreateTrainingResource,
  useDeleteTrainingResource,
  useListTerritories,
  useCreateTerritory,
  useDeleteTerritory,
  getListUsersQueryKey,
  getListIncentiveTiersQueryKey,
  getListPointConfigsQueryKey,
  getListRewardsQueryKey,
  getListRedemptionsQueryKey,
  getListTrainingResourcesQueryKey,
  getListTerritoriesQueryKey,
} from "@workspace/api-client-react";
import type {
  CreateRewardBodyCategory,
  CreateTrainingResourceBodyCategory,
  CreatePointConfigBodyServiceType,
  UpdateUserBodyRole,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Trash2, Plus, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const SERVICE_TYPES: CreatePointConfigBodyServiceType[] = [
  "large_removal", "trimming_pruning", "stump_grinding", "other",
];
const REWARD_CATEGORIES: CreateRewardBodyCategory[] = ["gear", "pto", "trip", "cash", "other"];
const TRAINING_CATEGORIES: CreateTrainingResourceBodyCategory[] = [
  "sales_script", "tree_identification", "product_knowledge", "objection_handling", "other",
];

export default function AdminPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Admin Panel ⚙️</h1>
        <p className="mt-1 text-muted-foreground">Manage your team, points, rewards, and content.</p>
      </div>
      <Tabs defaultValue="users" className="space-y-4">
        <TabsList className="rounded-xl flex-wrap h-auto">
          <TabsTrigger value="users" className="rounded-lg">Reps</TabsTrigger>
          <TabsTrigger value="tiers" className="rounded-lg">Incentive Tiers</TabsTrigger>
          <TabsTrigger value="points" className="rounded-lg">Point Config</TabsTrigger>
          <TabsTrigger value="rewards" className="rounded-lg">Rewards</TabsTrigger>
          <TabsTrigger value="redemptions" className="rounded-lg">Redemptions</TabsTrigger>
          <TabsTrigger value="training" className="rounded-lg">Training</TabsTrigger>
          <TabsTrigger value="territories" className="rounded-lg">Territories</TabsTrigger>
        </TabsList>
        <TabsContent value="users"><UsersTab /></TabsContent>
        <TabsContent value="tiers"><TiersTab /></TabsContent>
        <TabsContent value="points"><PointsTab /></TabsContent>
        <TabsContent value="rewards"><RewardsTab /></TabsContent>
        <TabsContent value="redemptions"><RedemptionsTab /></TabsContent>
        <TabsContent value="training"><TrainingTab /></TabsContent>
        <TabsContent value="territories"><TerritoriesTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function UsersTab() {
  const qc = useQueryClient();
  const { data: users } = useListUsers();
  const update = useUpdateUser();
  return (
    <Card className="divide-y divide-border">
      {(users ?? []).map((u) => (
        <div key={u.id} className="flex items-center justify-between gap-3 p-4">
          <div className="min-w-0 flex-1">
            <div className="font-semibold">{u.name}</div>
            <div className="text-xs text-muted-foreground">{u.email}</div>
          </div>
          <Badge className={u.role === "admin" ? "bg-[#FFBF00] text-slate-900" : "bg-[#2EA3F2] text-white"}>
            {u.role}
          </Badge>
          <Select
            value={u.role}
            onValueChange={async (role) => {
              await update.mutateAsync({ userId: u.id, data: { role: role as UpdateUserBodyRole } });
              qc.invalidateQueries({ queryKey: getListUsersQueryKey() });
            }}
          >
            <SelectTrigger className="w-32 rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="rep">Rep</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>
      ))}
    </Card>
  );
}

function TiersTab() {
  const qc = useQueryClient();
  const { data: tiers } = useListIncentiveTiers();
  const create = useCreateIncentiveTier();
  const remove = useDeleteIncentiveTier();
  const [form, setForm] = useState({
    name: "", pointThreshold: 0, color: "#2EA3F2",
    description: "", rewardDescription: "", displayOrder: 0,
  });
  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h3 className="mb-3 font-bold">Add tier</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <Input placeholder="Name (Bronze, Hawaii…)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input type="number" placeholder="Point threshold" value={form.pointThreshold} onChange={(e) => setForm({ ...form, pointThreshold: Number(e.target.value) })} />
          <Input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Textarea className="rounded-xl" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <Textarea className="rounded-xl" placeholder="Reward description (e.g. Hawaii trip for two)" value={form.rewardDescription} onChange={(e) => setForm({ ...form, rewardDescription: e.target.value })} />
        </div>
        <Input className="mt-3" type="number" placeholder="Display order" value={form.displayOrder} onChange={(e) => setForm({ ...form, displayOrder: Number(e.target.value) })} />
        <Button
          className="mt-3 rounded-xl bg-[#2C8214] hover:bg-[#236812]"
          onClick={async () => {
            if (!form.name) return;
            await create.mutateAsync({ data: form });
            qc.invalidateQueries({ queryKey: getListIncentiveTiersQueryKey() });
            setForm({ name: "", pointThreshold: 0, color: "#2EA3F2", description: "", rewardDescription: "", displayOrder: 0 });
          }}
        >
          <Plus className="mr-1 h-4 w-4" /> Add tier
        </Button>
      </Card>
      <Card className="divide-y divide-border">
        {(tiers ?? []).slice().sort((a, b) => a.pointThreshold - b.pointThreshold).map((t) => (
          <div key={t.id} className="flex items-center gap-3 p-3">
            <div className="h-6 w-6 rounded-md" style={{ backgroundColor: t.color }} />
            <div className="flex-1">
              <div className="font-semibold">{t.name}</div>
              <div className="text-xs text-muted-foreground">
                {t.pointThreshold.toLocaleString()} pts • {t.rewardDescription}
              </div>
            </div>
            <Button variant="ghost" size="icon" className="rounded-full" onClick={async () => {
              await remove.mutateAsync({ tierId: t.id });
              qc.invalidateQueries({ queryKey: getListIncentiveTiersQueryKey() });
            }}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </Card>
    </div>
  );
}

function PointsTab() {
  const qc = useQueryClient();
  const { data: configs } = useListPointConfigs();
  const create = useCreatePointConfig();
  const update = useUpdatePointConfig();
  const remove = useDeletePointConfig();
  const [form, setForm] = useState<{ serviceType: CreatePointConfigBodyServiceType; pointsPer100: number; label: string }>({
    serviceType: "large_removal", pointsPer100: 10, label: "",
  });
  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h3 className="mb-3 font-bold">Service points (pts per $100)</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <Select value={form.serviceType} onValueChange={(v) => setForm({ ...form, serviceType: v as CreatePointConfigBodyServiceType })}>
            <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SERVICE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="number" placeholder="Points per $100" value={form.pointsPer100} onChange={(e) => setForm({ ...form, pointsPer100: Number(e.target.value) })} />
          <Input placeholder="Label (Tree Removal)" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
        </div>
        <Button
          className="mt-3 rounded-xl bg-[#2C8214] hover:bg-[#236812]"
          onClick={async () => {
            if (!form.label) return;
            await create.mutateAsync({ data: form });
            qc.invalidateQueries({ queryKey: getListPointConfigsQueryKey() });
            setForm({ serviceType: "large_removal", pointsPer100: 10, label: "" });
          }}
        >
          <Plus className="mr-1 h-4 w-4" /> Save
        </Button>
      </Card>
      <Card className="divide-y divide-border">
        {(configs ?? []).map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-3 p-3">
            <div className="flex-1">
              <div className="font-semibold">{c.label}</div>
              <div className="text-xs text-muted-foreground">{c.serviceType}</div>
            </div>
            <Input
              type="number"
              className="w-28"
              defaultValue={c.pointsPer100}
              onBlur={async (e) => {
                const v = Number(e.target.value);
                if (v === c.pointsPer100) return;
                await update.mutateAsync({ configId: c.id, data: { pointsPer100: v } });
                qc.invalidateQueries({ queryKey: getListPointConfigsQueryKey() });
              }}
            />
            <span className="text-xs text-muted-foreground">/$100</span>
            <Button variant="ghost" size="icon" className="rounded-full" onClick={async () => {
              await remove.mutateAsync({ configId: c.id });
              qc.invalidateQueries({ queryKey: getListPointConfigsQueryKey() });
            }}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </Card>
    </div>
  );
}

function RewardsTab() {
  const qc = useQueryClient();
  const { data: rewards } = useListRewards();
  const create = useCreateReward();
  const update = useUpdateReward();
  const remove = useDeleteReward();
  const [form, setForm] = useState<{ name: string; description: string; pointCost: number; category: CreateRewardBodyCategory; available: boolean; imageUrl: string }>({
    name: "", description: "", pointCost: 100, category: "gear", available: true, imageUrl: "",
  });
  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h3 className="mb-3 font-bold">Add reward</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input type="number" placeholder="Point cost" value={form.pointCost} onChange={(e) => setForm({ ...form, pointCost: Number(e.target.value) })} />
          <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as CreateRewardBodyCategory })}>
            <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              {REWARD_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input placeholder="Image URL (optional)" value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} />
        </div>
        <Textarea className="mt-3 rounded-xl" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <Button
          className="mt-3 rounded-xl bg-[#2C8214] hover:bg-[#236812]"
          onClick={async () => {
            if (!form.name) return;
            await create.mutateAsync({
              data: {
                name: form.name, description: form.description, pointCost: form.pointCost,
                category: form.category, available: form.available, imageUrl: form.imageUrl || null,
              },
            });
            qc.invalidateQueries({ queryKey: getListRewardsQueryKey() });
            setForm({ name: "", description: "", pointCost: 100, category: "gear", available: true, imageUrl: "" });
          }}
        >
          <Plus className="mr-1 h-4 w-4" /> Add reward
        </Button>
      </Card>
      <Card className="divide-y divide-border">
        {(rewards ?? []).map((r) => (
          <div key={r.id} className="flex items-center gap-3 p-3">
            <div className="flex-1">
              <div className="font-semibold">{r.name}</div>
              <div className="text-xs text-muted-foreground">{r.pointCost} pts • {r.category}</div>
            </div>
            <Button
              size="sm"
              variant={r.available ? "outline" : "default"}
              className="rounded-xl"
              onClick={async () => {
                await update.mutateAsync({ rewardId: r.id, data: { available: !r.available } });
                qc.invalidateQueries({ queryKey: getListRewardsQueryKey() });
              }}
            >
              {r.available ? "Available" : "Hidden"}
            </Button>
            <Button variant="ghost" size="icon" className="rounded-full" onClick={async () => {
              await remove.mutateAsync({ rewardId: r.id });
              qc.invalidateQueries({ queryKey: getListRewardsQueryKey() });
            }}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </Card>
    </div>
  );
}

function RedemptionsTab() {
  const qc = useQueryClient();
  const { data: reds } = useListRedemptions();
  const update = useUpdateRedemption();
  const { toast } = useToast();
  return (
    <Card className="divide-y divide-border">
      {(reds ?? []).map((r) => (
        <div key={r.id} className="flex items-center gap-3 p-4">
          <div className="flex-1">
            <div className="font-semibold">{r.rewardName}</div>
            <div className="text-xs text-muted-foreground">
              {r.userName} • {r.pointCost} pts • {new Date(r.createdAt).toLocaleString()}
            </div>
          </div>
          <Badge className={
            r.status === "approved" ? "bg-[#2C8214] text-white"
            : r.status === "rejected" ? "bg-red-500 text-white"
            : "bg-[#FFBF00] text-slate-900"
          }>{r.status}</Badge>
          {r.status === "pending" && (
            <>
              <Button size="sm" className="rounded-xl bg-[#2C8214]" onClick={async () => {
                await update.mutateAsync({ redemptionId: r.id, data: { status: "approved" } });
                qc.invalidateQueries({ queryKey: getListRedemptionsQueryKey() });
                toast({ title: "Approved" });
              }}><Check className="h-4 w-4" /></Button>
              <Button size="sm" variant="outline" className="rounded-xl" onClick={async () => {
                await update.mutateAsync({ redemptionId: r.id, data: { status: "rejected" } });
                qc.invalidateQueries({ queryKey: getListRedemptionsQueryKey() });
              }}><X className="h-4 w-4" /></Button>
            </>
          )}
        </div>
      ))}
      {reds && reds.length === 0 && (
        <div className="p-8 text-center text-sm text-muted-foreground">No redemption requests yet.</div>
      )}
    </Card>
  );
}

function TrainingTab() {
  const qc = useQueryClient();
  const { data: items } = useListTrainingResources();
  const create = useCreateTrainingResource();
  const remove = useDeleteTrainingResource();
  const [form, setForm] = useState<{ title: string; description: string; category: CreateTrainingResourceBodyCategory; contentText: string; contentUrl: string; thumbnailUrl: string; displayOrder: number }>({
    title: "", description: "", category: "sales_script",
    contentText: "", contentUrl: "", thumbnailUrl: "", displayOrder: 0,
  });
  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h3 className="mb-3 font-bold">Add training resource</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as CreateTrainingResourceBodyCategory })}>
            <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              {TRAINING_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input placeholder="Content URL (optional)" value={form.contentUrl} onChange={(e) => setForm({ ...form, contentUrl: e.target.value })} />
          <Input placeholder="Thumbnail URL (optional)" value={form.thumbnailUrl} onChange={(e) => setForm({ ...form, thumbnailUrl: e.target.value })} />
        </div>
        <Textarea className="mt-3 rounded-xl" placeholder="Short description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <Textarea className="mt-3 rounded-xl min-h-[120px]" placeholder="Content text (script, tree facts, etc.)" value={form.contentText} onChange={(e) => setForm({ ...form, contentText: e.target.value })} />
        <Button
          className="mt-3 rounded-xl bg-[#2C8214] hover:bg-[#236812]"
          onClick={async () => {
            if (!form.title) return;
            await create.mutateAsync({
              data: {
                title: form.title, description: form.description, category: form.category,
                contentText: form.contentText || null, contentUrl: form.contentUrl || null,
                thumbnailUrl: form.thumbnailUrl || null, displayOrder: form.displayOrder,
              },
            });
            qc.invalidateQueries({ queryKey: getListTrainingResourcesQueryKey() });
            setForm({ title: "", description: "", category: "sales_script", contentText: "", contentUrl: "", thumbnailUrl: "", displayOrder: 0 });
          }}
        >
          <Plus className="mr-1 h-4 w-4" /> Add
        </Button>
      </Card>
      <Card className="divide-y divide-border">
        {(items ?? []).map((t) => (
          <div key={t.id} className="flex items-center gap-3 p-3">
            <div className="flex-1 min-w-0">
              <div className="font-semibold">{t.title}</div>
              <div className="truncate text-xs text-muted-foreground">{t.description}</div>
            </div>
            <Badge variant="outline">{t.category}</Badge>
            <Button variant="ghost" size="icon" className="rounded-full" onClick={async () => {
              await remove.mutateAsync({ resourceId: t.id });
              qc.invalidateQueries({ queryKey: getListTrainingResourcesQueryKey() });
            }}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </Card>
    </div>
  );
}

function TerritoriesTab() {
  const qc = useQueryClient();
  const { data: terrs } = useListTerritories();
  const create = useCreateTerritory();
  const remove = useDeleteTerritory();
  const { data: users } = useListUsers();
  const [form, setForm] = useState<{ name: string; color: string; assignedRepId: number | null; description: string }>({
    name: "", color: "#2EA3F2", assignedRepId: null, description: "",
  });
  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h3 className="mb-3 font-bold">Add territory</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <Input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
          <Select value={form.assignedRepId?.toString() ?? "none"} onValueChange={(v) => setForm({ ...form, assignedRepId: v === "none" ? null : Number(v) })}>
            <SelectTrigger className="rounded-xl"><SelectValue placeholder="Assign rep" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Unassigned</SelectItem>
              {(users ?? []).map((u) => <SelectItem key={u.id} value={u.id.toString()}>{u.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Textarea className="mt-3 rounded-xl" placeholder="Description (optional)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <Button
          className="mt-3 rounded-xl bg-[#2C8214] hover:bg-[#236812]"
          onClick={async () => {
            if (!form.name) return;
            await create.mutateAsync({
              data: {
                name: form.name, color: form.color, assignedRepId: form.assignedRepId,
                description: form.description || null, bounds: null,
              },
            });
            qc.invalidateQueries({ queryKey: getListTerritoriesQueryKey() });
            setForm({ name: "", color: "#2EA3F2", assignedRepId: null, description: "" });
          }}
        >
          <Plus className="mr-1 h-4 w-4" /> Add
        </Button>
      </Card>
      <Card className="divide-y divide-border">
        {(terrs ?? []).map((t) => (
          <div key={t.id} className="flex items-center gap-3 p-3">
            <div className="h-6 w-6 rounded-md" style={{ backgroundColor: t.color }} />
            <div className="flex-1">
              <div className="font-semibold">{t.name}</div>
              <div className="text-xs text-muted-foreground">{t.assignedRepName ?? "Unassigned"}</div>
            </div>
            <Button variant="ghost" size="icon" className="rounded-full" onClick={async () => {
              await remove.mutateAsync({ territoryId: t.id });
              qc.invalidateQueries({ queryKey: getListTerritoriesQueryKey() });
            }}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </Card>
    </div>
  );
}
