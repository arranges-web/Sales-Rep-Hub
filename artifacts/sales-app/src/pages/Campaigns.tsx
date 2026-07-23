import { useEffect, useMemo, useState } from "react";
import {
  useListCampaigns,
  useCreateCampaign,
  useGetCampaign,
  useUpdateCampaign,
  useDeleteCampaign,
  useAddCampaignStreets,
  useUpdateCampaignStreet,
  useDeleteCampaignStreet,
  getListCampaignsQueryKey,
  getGetCampaignQueryKey,
  type Campaign,
  type CampaignStreet,
  type CampaignDetail,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Megaphone,
  Plus,
  ArrowLeft,
  Trash2,
  CheckCircle2,
  Circle,
  CircleDot,
  Minus,
  DoorOpen,
  FileText,
  Sparkles,
  TrendingUp,
  Loader2,
  Pencil,
  X,
} from "lucide-react";
import { BrandHeader } from "@/components/BrandHeader";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { EmptyState } from "@/components/EmptyState";

const TYPE_META: Record<
  "door" | "flyer",
  { label: string; icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; color: string }
> = {
  door:  { label: "Door knocks", icon: DoorOpen, color: "#3DA935" },
  flyer: { label: "Flyer drop",  icon: FileText, color: "#FFBF00" },
};

const STATUS_META: Record<
  "active" | "paused" | "complete",
  { label: string; color: string }
> = {
  active:   { label: "Active",   color: "#2C8214" },
  paused:   { label: "Paused",   color: "#FFBF00" },
  complete: { label: "Complete", color: "#94a3b8" },
};

function progressPct(c: Campaign): number {
  if (!c.streetCount) return 0;
  return Math.round((c.doneCount / c.streetCount) * 100);
}

export default function CampaignsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: campaigns } = useListCampaigns();
  const create = useCreateCampaign();
  const [openCreate, setOpenCreate] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);

  const [form, setForm] = useState({
    name: "",
    description: "",
    type: "door" as "door" | "flyer",
    color: "#3DA935",
    streets: "",
  });

  const totals = useMemo(() => {
    const all = campaigns ?? [];
    const acc = { active: 0, paused: 0, complete: 0, streets: 0, done: 0 };
    for (const c of all) {
      acc[c.status] += 1;
      acc.streets += c.streetCount;
      acc.done += c.doneCount;
    }
    return acc;
  }, [campaigns]);

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6 lg:p-8">
      <BrandHeader
        title="Campaigns"
        subtitle="Door routes & flyer drops. Build a list of streets, then crush it block by block."
        icon={<Megaphone className="h-6 w-6 text-[#3DA935]" strokeWidth={1.5} />}
        actions={
          <Button
            onClick={() => setOpenCreate(true)}
            className="rounded-xl bg-[#3DA935] text-slate-950 hover:bg-[#4FBF45]"
          >
            <Plus className="mr-1 h-4 w-4" strokeWidth={2.5} />
            New campaign
          </Button>
        }
      />

      {/* Stats strip */}
      <div className="grid gap-3 sm:grid-cols-4">
        <StatTile label="Active" value={totals.active} color="#2C8214" />
        <StatTile label="Paused" value={totals.paused} color="#FFBF00" />
        <StatTile label="Streets in flight" value={totals.streets} color="#3DA935" />
        <StatTile
          label="Streets done"
          value={totals.done}
          color="#a78bfa"
          extra={
            totals.streets > 0
              ? `${Math.round((totals.done / totals.streets) * 100)}%`
              : undefined
          }
        />
      </div>

      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>New campaign</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Type</Label>
              <div className="mt-1 grid grid-cols-2 gap-2">
                {(["door", "flyer"] as const).map((t) => {
                  const meta = TYPE_META[t];
                  const Icon = meta.icon;
                  return (
                    <button
                      key={t}
                      onClick={() => setForm({ ...form, type: t, color: meta.color })}
                      className={cn(
                        "flex items-center gap-3 rounded-xl border p-3 text-left transition-all",
                        form.type === t
                          ? "border-[#3DA935] bg-[#3DA935]/10"
                          : "border-border bg-card hover:bg-muted",
                      )}
                    >
                      <span
                        className="flex h-9 w-9 items-center justify-center rounded-lg"
                        style={{ background: `${meta.color}22`, color: meta.color }}
                      >
                        <Icon className="h-5 w-5" strokeWidth={2} />
                      </span>
                      <div>
                        <div className="font-bold">{meta.label}</div>
                        <div className="text-xs text-muted-foreground">
                          {t === "door"
                            ? "Walk every door, track conversions"
                            : "Drop flyers on a planned route"}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Edgewater Wednesday push"
                className="mt-1 rounded-xl"
              />
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Goal: 200 doors before sundown."
                className="mt-1 rounded-xl"
              />
            </div>
            <div>
              <Label>
                Streets (one per line, optional)
                <span className="ml-1 text-xs text-muted-foreground">
                  — you can add more later
                </span>
              </Label>
              <Textarea
                value={form.streets}
                onChange={(e) => setForm({ ...form, streets: e.target.value })}
                placeholder={"Palm Way\nHibiscus Dr\nLighthouse Pt"}
                rows={5}
                className="mt-1 rounded-xl font-mono text-sm"
              />
            </div>
            <Button
              disabled={!form.name.trim() || create.isPending}
              className="w-full rounded-xl bg-[#3DA935] text-slate-950 hover:bg-[#4FBF45]"
              onClick={async () => {
                try {
                  const streets = form.streets
                    .split("\n")
                    .map((s) => s.trim())
                    .filter((s) => s.length > 0);
                  await create.mutateAsync({
                    data: {
                      name: form.name.trim(),
                      description: form.description.trim() || null,
                      type: form.type,
                      color: form.color,
                      streets: streets.length > 0 ? streets : null,
                    },
                  });
                  qc.invalidateQueries({ queryKey: getListCampaignsQueryKey() });
                  toast({ title: "Campaign created" });
                  setForm({
                    name: "",
                    description: "",
                    type: "door",
                    color: "#3DA935",
                    streets: "",
                  });
                  setOpenCreate(false);
                } catch (e) {
                  toast({
                    title: "Could not create",
                    description: String(e),
                    variant: "destructive",
                  });
                }
              }}
            >
              {create.isPending ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-1 h-4 w-4" />
              )}
              Launch campaign
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Campaign list */}
      {campaigns == null ? (
        <Card className="p-8">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
        </Card>
      ) : campaigns.length === 0 ? (
        <EmptyState
          title="No campaigns yet"
          description="Start a door route or flyer drop. Reps tick off streets as they finish them."
          icon={<Megaphone className="h-6 w-6" strokeWidth={1.5} />}
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2 jt-fade-in-stagger">
          {campaigns.map((c) => (
            <CampaignCard
              key={c.id}
              c={c}
              onOpen={() => setOpenId(c.id)}
            />
          ))}
        </div>
      )}

      {/* Detail dialog */}
      <Dialog open={openId != null} onOpenChange={(o) => !o && setOpenId(null)}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto rounded-2xl p-0">
          {openId != null && (
            <CampaignDetailView campaignId={openId} onClose={() => setOpenId(null)} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatTile({
  label,
  value,
  color,
  extra,
}: {
  label: string;
  value: number;
  color: string;
  extra?: string;
}) {
  return (
    <Card className="relative overflow-hidden p-3">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-20 blur-2xl"
        style={{ background: color }}
      />
      <div className="relative flex items-center gap-2">
        <span
          aria-hidden
          className="inline-block h-2 w-2 rounded-full"
          style={{ background: color, boxShadow: `0 0 8px ${color}80` }}
        />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        {extra && (
          <span
            className="ml-auto text-[11px] font-bold tabular-nums"
            style={{ color }}
          >
            {extra}
          </span>
        )}
      </div>
      <div className="font-stat mt-1 text-2xl font-extrabold tabular-nums">
        {value}
      </div>
    </Card>
  );
}

function CampaignCard({
  c,
  onOpen,
}: {
  c: Campaign;
  onOpen: () => void;
}) {
  const meta = TYPE_META[c.type];
  const Icon = meta.icon;
  const pct = progressPct(c);
  const statusMeta = STATUS_META[c.status];
  return (
    <button
      onClick={onOpen}
      className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-[#3DA935]/40 hover:shadow-[0_18px_40px_-20px_rgba(61,169,53,0.4)]"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full opacity-20 blur-3xl transition-opacity group-hover:opacity-30"
        style={{ background: c.color }}
      />
      <div className="relative flex items-start gap-3">
        <span
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
          style={{ background: `${c.color}22`, color: c.color }}
        >
          <Icon className="h-6 w-6" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-extrabold">{c.name}</h3>
            <Badge
              className="rounded-full border-0 px-2 py-0.5 text-[10px] font-bold uppercase"
              style={{ color: statusMeta.color, background: `${statusMeta.color}1f` }}
            >
              {statusMeta.label}
            </Badge>
          </div>
          {c.description && (
            <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
              {c.description}
            </p>
          )}
          <div className="mt-1 text-[11px] text-muted-foreground">
            by {c.createdByName ?? "Unknown"} ·{" "}
            {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}
          </div>
        </div>
      </div>

      <div className="relative mt-4 space-y-2">
        <div className="flex items-baseline justify-between text-xs">
          <span className="text-muted-foreground">
            <span className="font-stat font-bold text-foreground tabular-nums">
              {c.doneCount}
            </span>{" "}
            / {c.streetCount} streets done
          </span>
          <span
            className="font-stat font-bold tabular-nums"
            style={{ color: c.color }}
          >
            {pct}%
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-foreground/10">
          <div
            className="h-full rounded-full transition-[width] duration-700"
            style={{
              width: `${pct}%`,
              background: `linear-gradient(90deg, ${c.color}, #2C8214)`,
              boxShadow: `0 0 12px ${c.color}80`,
            }}
          />
        </div>
        <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
          <span>
            <DoorOpen className="mr-0.5 inline h-3 w-3" />{" "}
            <span className="font-stat font-bold text-foreground tabular-nums">
              {c.totalDoorsKnocked}
            </span>{" "}
            knocks
          </span>
          <span>
            <FileText className="mr-0.5 inline h-3 w-3" />{" "}
            <span className="font-stat font-bold text-foreground tabular-nums">
              {c.totalFlyersHandedOut}
            </span>{" "}
            flyers
          </span>
          {c.inProgressCount > 0 && (
            <span className="ml-auto text-[#FFBF00]">
              {c.inProgressCount} in progress
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function CampaignDetailView({
  campaignId,
  onClose,
}: {
  campaignId: number;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { data, isLoading } = useGetCampaign(campaignId);
  const update = useUpdateCampaign();
  const del = useDeleteCampaign();
  const addStreets = useAddCampaignStreets();
  const updateStreet = useUpdateCampaignStreet();
  const deleteStreet = useDeleteCampaignStreet();

  const [newStreets, setNewStreets] = useState("");
  const [editName, setEditName] = useState(false);
  const [name, setName] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "in_progress" | "done">(
    "all",
  );

  useEffect(() => {
    if (data) setName(data.name);
  }, [data?.name]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const c = data as CampaignDetail;
  const meta = TYPE_META[c.type];
  const Icon = meta.icon;
  const filteredStreets =
    filter === "all" ? c.streets : c.streets.filter((s) => s.status === filter);
  const pct = c.streetCount ? Math.round((c.doneCount / c.streetCount) * 100) : 0;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: getGetCampaignQueryKey(campaignId) });
    qc.invalidateQueries({ queryKey: getListCampaignsQueryKey() });
  };

  return (
    <div>
      {/* Header */}
      <div
        className="relative overflow-hidden p-5"
        style={{
          background: `linear-gradient(135deg, ${c.color}22, transparent 70%)`,
        }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-30 blur-3xl"
          style={{ background: c.color }}
        />
        <div className="relative flex items-start gap-3">
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-muted-foreground hover:bg-muted"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
            style={{ background: `${c.color}33`, color: c.color }}
          >
            <Icon className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <div className="min-w-0 flex-1">
            {editName ? (
              <div className="flex items-center gap-2">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="rounded-lg"
                />
                <Button
                  size="sm"
                  className="rounded-lg"
                  onClick={async () => {
                    await update.mutateAsync({
                      campaignId,
                      data: { name },
                    });
                    setEditName(false);
                    refresh();
                  }}
                >
                  Save
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h2 className="truncate text-xl font-extrabold">{c.name}</h2>
                <button
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => setEditName(true)}
                  title="Rename"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{meta.label}</span>
              <span>·</span>
              <span>by {c.createdByName ?? "Unknown"}</span>
              <span>·</span>
              <span>
                {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {(["active", "paused", "complete"] as const).map((s) => (
              <button
                key={s}
                onClick={async () => {
                  await update.mutateAsync({ campaignId, data: { status: s } });
                  refresh();
                }}
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase",
                  c.status === s
                    ? "text-slate-950"
                    : "border-border bg-card text-foreground/70 hover:text-foreground",
                )}
                style={
                  c.status === s
                    ? { background: STATUS_META[s].color, borderColor: STATUS_META[s].color }
                    : undefined
                }
              >
                {STATUS_META[s].label}
              </button>
            ))}
          </div>
        </div>

        {/* Progress bar */}
        <div className="relative mt-4">
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-muted-foreground">
              <span className="font-stat font-bold text-foreground tabular-nums">
                {c.doneCount}
              </span>{" "}
              / {c.streetCount} streets done
            </span>
            <span
              className="font-stat font-bold tabular-nums"
              style={{ color: c.color }}
            >
              {pct}%
            </span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-foreground/10">
            <div
              className="h-full rounded-full transition-[width] duration-700"
              style={{
                width: `${pct}%`,
                background: `linear-gradient(90deg, ${c.color}, #2C8214)`,
                boxShadow: `0 0 12px ${c.color}80`,
              }}
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
            <span>
              <DoorOpen className="mr-0.5 inline h-3 w-3" />{" "}
              <span className="font-stat font-bold text-foreground tabular-nums">
                {c.totalDoorsKnocked}
              </span>{" "}
              total knocks
            </span>
            <span>
              <FileText className="mr-0.5 inline h-3 w-3" />{" "}
              <span className="font-stat font-bold text-foreground tabular-nums">
                {c.totalFlyersHandedOut}
              </span>{" "}
              total flyers
            </span>
          </div>
        </div>
      </div>

      {/* Add streets */}
      <div className="border-t border-border bg-background/40 p-4">
        <Label className="text-xs uppercase tracking-wider">Add streets</Label>
        <div className="mt-1 flex flex-wrap items-end gap-2">
          <Textarea
            value={newStreets}
            onChange={(e) => setNewStreets(e.target.value)}
            placeholder="One street per line"
            rows={2}
            className="flex-1 min-w-[220px] rounded-xl font-mono text-sm"
          />
          <Button
            disabled={!newStreets.trim() || addStreets.isPending}
            onClick={async () => {
              const names = newStreets
                .split("\n")
                .map((s) => s.trim())
                .filter((s) => s.length > 0);
              if (names.length === 0) return;
              await addStreets.mutateAsync({
                campaignId,
                data: { names, city: null },
              });
              setNewStreets("");
              refresh();
            }}
            className="rounded-xl bg-[#3DA935] text-slate-950 hover:bg-[#4FBF45]"
          >
            <Plus className="mr-1 h-4 w-4" strokeWidth={2.5} />
            Add
          </Button>
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap items-center gap-1.5 px-4 pt-4">
        {(["all", "pending", "in_progress", "done"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-[11px] font-semibold capitalize transition-colors",
              filter === s
                ? "border-transparent bg-[#3DA935] text-slate-950"
                : "border-border bg-card text-foreground/70 hover:text-foreground",
            )}
          >
            {s === "in_progress" ? "in progress" : s}
          </button>
        ))}
        <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
          <TrendingUp className="h-3 w-3 text-[#FFBF00]" />
          {c.streets.length === 0
            ? "Add a street to get started"
            : pct === 100
              ? "Crushed it"
              : `${c.streetCount - c.doneCount} to go`}
        </span>
      </div>

      {/* Street list */}
      <ol className="divide-y divide-border p-4 pt-3">
        {filteredStreets.length === 0 && (
          <li className="p-4 text-center text-sm text-muted-foreground">
            {c.streets.length === 0
              ? "No streets added yet."
              : "No streets match this filter."}
          </li>
        )}
        {filteredStreets.map((s) => (
          <StreetRow
            key={s.id}
            street={s}
            campaignType={c.type}
            onChange={async (next) => {
              await updateStreet.mutateAsync({
                campaignId,
                streetId: s.id,
                data: next,
              });
              refresh();
            }}
            onDelete={async () => {
              await deleteStreet.mutateAsync({ campaignId, streetId: s.id });
              refresh();
            }}
          />
        ))}
      </ol>

      {/* Danger zone */}
      <div className="flex items-center justify-end border-t border-border bg-background/40 p-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={async () => {
            if (!confirm(`Delete campaign "${c.name}"? This removes all streets.`)) return;
            await del.mutateAsync({ campaignId });
            qc.invalidateQueries({ queryKey: getListCampaignsQueryKey() });
            onClose();
          }}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete campaign
        </Button>
      </div>
    </div>
  );
}

function StreetRow({
  street,
  campaignType,
  onChange,
  onDelete,
}: {
  street: CampaignStreet;
  campaignType: "door" | "flyer";
  onChange: (data: {
    status?: "pending" | "in_progress" | "done" | "skipped" | null;
    notes?: string | null;
    flyersHandedOut?: number | null;
    doorsKnocked?: number | null;
  }) => Promise<void>;
  onDelete: () => void;
}) {
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState(street.notes ?? "");
  useEffect(() => setNotes(street.notes ?? ""), [street.notes]);

  const statusIcon = (() => {
    if (street.status === "done") return <CheckCircle2 className="h-5 w-5 text-[#2C8214]" />;
    if (street.status === "in_progress")
      return <CircleDot className="h-5 w-5 text-[#FFBF00]" />;
    if (street.status === "skipped")
      return <Minus className="h-5 w-5 text-muted-foreground" />;
    return <Circle className="h-5 w-5 text-muted-foreground/60" />;
  })();

  const counter = campaignType === "flyer" ? "flyersHandedOut" : "doorsKnocked";
  const counterValue =
    campaignType === "flyer" ? street.flyersHandedOut : street.doorsKnocked;

  const cycleStatus = async () => {
    const next: "pending" | "in_progress" | "done" =
      street.status === "pending"
        ? "in_progress"
        : street.status === "in_progress"
          ? "done"
          : "pending";
    await onChange({ status: next });
  };

  return (
    <li
      className={cn(
        "flex flex-wrap items-center gap-3 py-3",
        street.status === "done" && "opacity-75",
      )}
    >
      <button
        onClick={cycleStatus}
        className="shrink-0 rounded-full p-1 transition-colors hover:bg-muted"
        title="Cycle status"
      >
        {statusIcon}
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "truncate text-sm font-semibold",
              street.status === "done" && "line-through text-muted-foreground",
            )}
          >
            {street.name}
          </span>
          {street.city && (
            <span className="text-xs text-muted-foreground">· {street.city}</span>
          )}
        </div>
        {editingNotes ? (
          <div className="mt-1 flex items-center gap-2">
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes for this street"
              className="rounded-lg"
            />
            <Button
              size="sm"
              variant="outline"
              className="rounded-lg"
              onClick={async () => {
                await onChange({ notes: notes || null });
                setEditingNotes(false);
              }}
            >
              Save
            </Button>
            <button
              onClick={() => {
                setNotes(street.notes ?? "");
                setEditingNotes(false);
              }}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : street.notes ? (
          <button
            onClick={() => setEditingNotes(true)}
            className="mt-0.5 line-clamp-1 text-left text-xs text-muted-foreground hover:text-foreground"
            title="Edit notes"
          >
            {street.notes}
          </button>
        ) : (
          <button
            onClick={() => setEditingNotes(true)}
            className="mt-0.5 text-[11px] text-muted-foreground/70 hover:text-foreground"
          >
            + add note
          </button>
        )}
        {street.completedByUserName && street.completedAt && (
          <div className="mt-0.5 text-[10px] text-muted-foreground">
            Done by {street.completedByUserName} ·{" "}
            {formatDistanceToNow(new Date(street.completedAt), { addSuffix: true })}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onChange({ [counter]: Math.max(0, counterValue - 1) })}
          className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted"
          title="-1"
          disabled={counterValue <= 0}
        >
          <Minus className="h-3 w-3" />
        </button>
        <div className="w-12 text-center text-xs">
          <div
            className="font-stat font-bold tabular-nums"
            style={{ color: campaignType === "flyer" ? "#FFBF00" : "#3DA935" }}
          >
            {counterValue}
          </div>
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground">
            {campaignType === "flyer" ? "flyers" : "knocks"}
          </div>
        </div>
        <button
          onClick={() => onChange({ [counter]: counterValue + 1 })}
          className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted"
          title="+1"
        >
          <Plus className="h-3 w-3" />
        </button>
        <button
          onClick={onDelete}
          className="ml-1 text-muted-foreground hover:text-destructive"
          title="Remove street"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </li>
  );
}
