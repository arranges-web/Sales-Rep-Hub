import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet.markercluster";
import type {} from "leaflet.markercluster";
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
import { PhotoUpload, photoServingUrl } from "@/components/PhotoUpload";

// Fix default Leaflet marker icon URLs (Vite asset bundling)
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const SWFL_CENTER: L.LatLngTuple = [26.6406, -81.8723];

function pinIcon(color: string) {
  return L.divIcon({
    className: "jt-pin",
    html: `<div style="
      width:30px;height:30px;border-radius:50% 50% 50% 0;
      background:${color};transform:rotate(-45deg);
      border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.4);
      display:flex;align-items:center;justify-content:center;">
      <div style="width:10px;height:10px;border-radius:50%;background:#fff;transform:rotate(45deg);"></div>
    </div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -28],
  });
}

const STATUS_COLORS = {
  lead: "#2EA3F2",
  sold: "#2C8214",
  follow_up: "#FFBF00",
} as const;

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18`,
      { headers: { Accept: "application/json" } },
    );
    if (!res.ok) return "";
    const data = (await res.json()) as { display_name?: string };
    return data.display_name ?? "";
  } catch {
    return "";
  }
}

type ParsedBounds =
  | { kind: "polygon"; latlngs: L.LatLngTuple[] }
  | { kind: "rect"; sw: L.LatLngTuple; ne: L.LatLngTuple }
  | null;

// Parse a four-number rectangle from legacy free-text bounds.
// Accepts "south,west,north,east" or "lat1,lng1,lat2,lng2".
function parseLegacyRect(text: string): ParsedBounds {
  const nums = text
    .split(/[,;\s]+/)
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n));
  if (nums.length !== 4) return null;
  const [a, b, c, d] = nums as [number, number, number, number];
  const south = Math.min(a, c);
  const north = Math.max(a, c);
  const west = Math.min(b, d);
  const east = Math.max(b, d);
  if (Math.abs(south) > 90 || Math.abs(north) > 90) return null;
  if (Math.abs(west) > 180 || Math.abs(east) > 180) return null;
  return { kind: "rect", sw: [south, west], ne: [north, east] };
}

function parseBounds(b: string | null | undefined): ParsedBounds {
  if (!b) return null;
  try {
    const parsed = JSON.parse(b) as {
      type?: string;
      coordinates?: [number, number][][];
    };
    if (parsed?.type === "Polygon" && Array.isArray(parsed.coordinates?.[0])) {
      return {
        kind: "polygon",
        latlngs: parsed.coordinates[0].map(
          ([lng, lat]) => [lat, lng] as L.LatLngTuple,
        ),
      };
    }
  } catch {
    // not JSON — try legacy rectangle format below
  }
  return parseLegacyRect(b);
}

export default function MapPage() {
  const qc = useQueryClient();
  const { data: pins } = useListPins();
  const { data: territories } = useListTerritories();
  const create = useCreatePin();
  const del = useDeletePin();
  const update = useUpdatePin();

  const [filter, setFilter] = useState<"all" | "lead" | "sold">("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    address: "",
    latitude: SWFL_CENTER[0],
    longitude: SWFL_CENTER[1],
    notes: "",
    photoUrl: null as string | null,
    status: "lead" as "lead" | "sold",
  });

  const filtered = useMemo(
    () => (pins ?? []).filter((p) => filter === "all" || p.status === filter),
    [pins, filter],
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const territoryLayerRef = useRef<L.LayerGroup | null>(null);

  // Init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: SWFL_CENTER,
      zoom: 11,
      scrollWheelZoom: true,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);

    const cluster = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 50,
    });
    map.addLayer(cluster);
    clusterRef.current = cluster;

    const territoryLayer = L.layerGroup().addTo(map);
    territoryLayerRef.current = territoryLayer;

    map.on("click", async (e) => {
      const { lat, lng } = e.latlng;
      const address = await reverseGeocode(lat, lng);
      setForm((f) => ({
        ...f,
        latitude: Number(lat.toFixed(6)),
        longitude: Number(lng.toFixed(6)),
        // Use the new geocode result, or clear stale address from a previous tap
        address: address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      }));
      setOpen(true);
    });

    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 100);

    return () => {
      map.remove();
      mapRef.current = null;
      clusterRef.current = null;
      territoryLayerRef.current = null;
    };
  }, []);

  // Render territories
  useEffect(() => {
    const layer = territoryLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    (territories ?? []).forEach((t) => {
      const parsed = parseBounds(t.bounds);
      if (!parsed) return;
      const style = {
        color: t.color,
        weight: 2,
        fillColor: t.color,
        fillOpacity: 0.15,
      };
      if (parsed.kind === "polygon") {
        if (parsed.latlngs.length < 3) return;
        L.polygon(parsed.latlngs, style)
          .bindTooltip(t.name, { sticky: true })
          .addTo(layer);
      } else {
        L.rectangle([parsed.sw, parsed.ne], style)
          .bindTooltip(`${t.name} (legacy)`, { sticky: true })
          .addTo(layer);
      }
    });
  }, [territories]);

  // Render markers
  useEffect(() => {
    const cluster = clusterRef.current;
    if (!cluster) return;
    cluster.clearLayers();
    filtered.forEach((p) => {
      const color =
        STATUS_COLORS[p.status as keyof typeof STATUS_COLORS] ?? STATUS_COLORS.lead;
      const m = L.marker([p.latitude, p.longitude], { icon: pinIcon(color) });
      const rawPhoto = photoServingUrl(p.photoUrl);
      // Only allow same-origin paths or http(s) URLs in the popup img src
      const photo =
        rawPhoto &&
        (rawPhoto.startsWith("/") ||
          rawPhoto.startsWith("http://") ||
          rawPhoto.startsWith("https://"))
          ? rawPhoto
          : null;
      const safeStatus = String(p.status).replace(/[^a-z_]/gi, "");
      const popupHtml = `
        <div style="min-width:180px;font-family:'Open Sans',sans-serif;">
          <div style="font-weight:700;margin-bottom:2px;">${escapeHtml(p.address)}</div>
          <div style="font-size:11px;color:#64748b;margin-bottom:4px;">
            by ${escapeHtml(p.repName)} · ${escapeHtml(safeStatus)}
          </div>
          ${p.notes ? `<div style="font-size:12px;margin-bottom:6px;">${escapeHtml(p.notes)}</div>` : ""}
          ${photo ? `<img src="${escapeHtml(photo)}" style="max-width:100%;border-radius:8px;margin-bottom:6px;"/>` : ""}
          <div style="display:flex;gap:6px;">
            ${
              p.status === "lead"
                ? `<button data-action="sold" data-id="${p.id}" style="flex:1;background:#2C8214;color:white;border:none;border-radius:8px;padding:4px 8px;font-size:12px;cursor:pointer;">Mark sold</button>`
                : ""
            }
            <button data-action="delete" data-id="${p.id}" style="background:#ef4444;color:white;border:none;border-radius:8px;padding:4px 8px;font-size:12px;cursor:pointer;">Delete</button>
          </div>
        </div>`;
      m.bindPopup(popupHtml);
      m.on("popupopen", (ev) => {
        const el = (ev.popup.getElement() as HTMLElement | null) ?? null;
        if (!el) return;
        el.querySelectorAll<HTMLButtonElement>("button[data-action]").forEach(
          (btn) => {
            btn.onclick = async () => {
              const action = btn.dataset.action;
              const id = Number(btn.dataset.id);
              if (action === "sold") {
                await update.mutateAsync({ pinId: id, data: { status: "sold" } });
              } else if (action === "delete") {
                await del.mutateAsync({ pinId: id });
              }
              qc.invalidateQueries({ queryKey: getListPinsQueryKey() });
              mapRef.current?.closePopup();
            };
          },
        );
      });
      cluster.addLayer(m);
    });
  }, [filtered, update, del, qc]);

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            Canvassing Map 📍
          </h1>
          <p className="mt-1 text-muted-foreground">
            Tap the map to drop a pin at any location.
          </p>
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
            <DialogContent className="rounded-2xl max-h-[90vh] overflow-y-auto">
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
                    className="rounded-xl"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Latitude</Label>
                    <Input
                      type="number"
                      step="0.000001"
                      value={form.latitude}
                      onChange={(e) =>
                        setForm({ ...form, latitude: Number(e.target.value) })
                      }
                      className="rounded-xl"
                    />
                  </div>
                  <div>
                    <Label>Longitude</Label>
                    <Input
                      type="number"
                      step="0.000001"
                      value={form.longitude}
                      onChange={(e) =>
                        setForm({ ...form, longitude: Number(e.target.value) })
                      }
                      className="rounded-xl"
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
                <div>
                  <Label>Photo</Label>
                  <PhotoUpload
                    value={form.photoUrl}
                    onChange={(p) => setForm({ ...form, photoUrl: p })}
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
                        photoUrl: form.photoUrl || null,
                        dealId: null,
                      },
                    });
                    setForm({
                      address: "",
                      latitude: SWFL_CENTER[0],
                      longitude: SWFL_CENTER[1],
                      notes: "",
                      photoUrl: null,
                      status: "lead",
                    });
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
        <div ref={containerRef} className="h-[480px] w-full" />
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((p) => {
          const photo = photoServingUrl(p.photoUrl);
          return (
            <Card key={p.id} className="p-4">
              <div className="flex items-start gap-3">
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                  style={{
                    backgroundColor:
                      p.status === "sold" ? "#2C821420" : "#2EA3F220",
                    color: p.status === "sold" ? "#2C8214" : "#2EA3F2",
                  }}
                >
                  <MapPin className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Badge
                      className="text-white capitalize"
                      style={{
                        backgroundColor:
                          p.status === "sold" ? "#2C8214" : "#2EA3F2",
                      }}
                    >
                      {p.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(p.createdAt), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                  <div className="mt-1 truncate font-semibold text-sm">
                    {p.address}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    by {p.repName}
                  </div>
                  {p.notes && <p className="mt-1 text-sm">{p.notes}</p>}
                  {photo && (
                    <img
                      src={photo}
                      alt=""
                      className="mt-2 h-24 w-full rounded-lg object-cover"
                    />
                  )}
                  <div className="mt-2 flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-xl"
                      onClick={() => {
                        mapRef.current?.flyTo([p.latitude, p.longitude], 16);
                      }}
                    >
                      View on map
                    </Button>
                    {p.status === "lead" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-xl"
                        onClick={async () => {
                          await update.mutateAsync({
                            pinId: p.id,
                            data: { status: "sold" },
                          });
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
          );
        })}
      </div>
    </div>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
