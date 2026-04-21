import { useState } from "react";
import {
  useListPins,
  useCreatePin,
  useDeletePin,
  useUpdatePin,
  useListTerritories,
  getListPinsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { MapPin, Plus, Trash2, CheckCircle2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

// SWFL center
const CENTER = { lat: 26.6406, lng: -81.8723 };
const SPAN = 1.2;

export default function MapPage() {
  const qc = useQueryClient();
  const { data: pins } = useListPins();
  const { data: territories } = useListTerritories();
  const create = useCreatePin();
  const del = useDeletePin();
  const update = useUpdatePin();

  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "lead" | "sold">("all");
  const [form, setForm] = useState({
    address: "",
    latitude: CENTER.lat,
    longitude: CENTER.lng,
    notes: "",
    status: "lead" as "lead" | "sold",
  });

  const filtered = (pins ?? []).filter((p) => filter === "all" || p.status === filter);

  const project = (lat: number, lng: number) => {
    const x = ((lng - (CENTER.lng - SPAN / 2)) / SPAN) * 100;
    const y = (1 - (lat - (CENTER.lat - SPAN / 2)) / SPAN) * 100;
    return { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) };
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Canvassing Map 📍</h1>
          <p className="mt-1 text-muted-foreground">SWFL territory at a glance.</p>
        </div>
        <div className="flex gap-2">
          {(["all", "lead", "sold"] as const).map((f) => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? "default" : "outline"}
              onClick={() => setFilter(f)}
              className="rounded-xl capitalize"
            >
              {f}
            </Button>
          ))}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-xl bg-[#2EA3F2] hover:bg-[#1d8fd8]">
                <Plus className="mr-1 h-4 w-4" /> Drop Pin
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-2xl">
              <DialogHeader>
                <DialogTitle>Drop a pin</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Address</Label>
                  <Input
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    placeholder="123 Palm Way, Fort Myers FL"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Latitude</Label>
                    <Input
                      type="number"
                      step="0.0001"
                      value={form.latitude}
                      onChange={(e) => setForm({ ...form, latitude: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label>Longitude</Label>
                    <Input
                      type="number"
                      step="0.0001"
                      value={form.longitude}
                      onChange={(e) => setForm({ ...form, longitude: Number(e.target.value) })}
                    />
                  </div>
                </div>
                <div>
                  <Label>Status</Label>
                  <div className="mt-1 flex gap-2">
                    {(["lead", "sold"] as const).map((s) => (
                      <Button
                        key={s}
                        type="button"
                        variant={form.status === s ? "default" : "outline"}
                        onClick={() => setForm({ ...form, status: s })}
                        className="rounded-xl capitalize"
                      >
                        {s}
                      </Button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label>Notes</Label>
                  <Textarea
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="Owner home, large oak in front, follow up Friday…"
                    className="rounded-xl"
                  />
                </div>
                <Button
                  className="w-full rounded-xl bg-[#2EA3F2] hover:bg-[#1d8fd8]"
                  onClick={async () => {
                    if (!form.address) return;
                    await create.mutateAsync({
                      data: {
                        latitude: form.latitude,
                        longitude: form.longitude,
                        address: form.address,
                        status: form.status,
                        notes: form.notes || null,
                        photoUrl: null,
                        dealId: null,
                      },
                    });
                    setForm({ ...form, address: "", notes: "" });
                    setOpen(false);
                    qc.invalidateQueries({ queryKey: getListPinsQueryKey() });
                  }}
                >
                  Drop Pin
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="overflow-hidden">
        {/* Stylized map */}
        <div
          className="relative h-[420px] w-full"
          style={{
            background:
              "linear-gradient(180deg, #e0f2fe 0%, #d1fae5 60%, #fef3c7 100%)",
          }}
        >
          {/* Territory overlays */}
          {(territories ?? []).map((t, idx) => (
            <div
              key={t.id}
              className="absolute rounded-3xl border-2 border-dashed opacity-40"
              style={{
                borderColor: t.color,
                backgroundColor: `${t.color}15`,
                left: `${10 + idx * 18}%`,
                top: `${15 + (idx % 2) * 30}%`,
                width: "22%",
                height: "28%",
              }}
              title={t.name}
            >
              <div
                className="absolute -top-3 left-2 rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
                style={{ backgroundColor: t.color }}
              >
                {t.name}
              </div>
            </div>
          ))}
          {/* Pins */}
          {filtered.map((p) => {
            const { x, y } = project(p.latitude, p.longitude);
            return (
              <div
                key={p.id}
                className="group absolute -translate-x-1/2 -translate-y-full"
                style={{ left: `${x}%`, top: `${y}%` }}
              >
                <MapPin
                  className="h-7 w-7 drop-shadow-lg"
                  style={{ color: p.status === "sold" ? "#2C8214" : "#2EA3F2" }}
                  fill={p.status === "sold" ? "#2C8214" : "#2EA3F2"}
                />
                <div className="absolute left-1/2 top-full hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-2 py-1 text-xs text-white group-hover:block">
                  {p.address}
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-600">
              No pins yet — drop your first one!
            </div>
          )}
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((p) => (
          <Card key={p.id} className="p-4">
            <div className="flex items-start gap-3">
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                style={{
                  backgroundColor: p.status === "sold" ? "#2C821420" : "#2EA3F220",
                  color: p.status === "sold" ? "#2C8214" : "#2EA3F2",
                }}
              >
                <MapPin className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Badge
                    className="text-white capitalize"
                    style={{ backgroundColor: p.status === "sold" ? "#2C8214" : "#2EA3F2" }}
                  >
                    {p.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(p.createdAt), { addSuffix: true })}
                  </span>
                </div>
                <div className="mt-1 truncate font-semibold text-sm">{p.address}</div>
                <div className="text-xs text-muted-foreground">by {p.repName}</div>
                {p.notes && <p className="mt-1 text-sm">{p.notes}</p>}
                <div className="mt-2 flex gap-1">
                  {p.status === "lead" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-xl"
                      onClick={async () => {
                        await update.mutateAsync({ pinId: p.id, data: { status: "sold" } });
                        qc.invalidateQueries({ queryKey: getListPinsQueryKey() });
                      }}
                    >
                      <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Mark sold
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="rounded-xl"
                    onClick={async () => {
                      await del.mutateAsync({ pinId: p.id });
                      qc.invalidateQueries({ queryKey: getListPinsQueryKey() });
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
