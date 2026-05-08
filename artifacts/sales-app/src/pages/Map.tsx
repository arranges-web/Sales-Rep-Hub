import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet.markercluster";
import type {} from "leaflet.markercluster";
import {
  useListPins,
  useCreatePin,
  useDeletePin,
  useUpdatePin,
  useSkipTracePin,
  useListTerritories,
  getListPinsQueryKey,
  type MapPin as ApiPin,
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
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  MapPin,
  Trash2,
  CheckCircle2,
  Phone,
  User,
  Search,
  Layers,
  DoorOpen,
  Navigation,
  Loader2,
} from "lucide-react";
import { AvatarRing } from "@/components/AvatarRing";
import { BrandHeader } from "@/components/BrandHeader";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { PhotoUpload, photoServingUrl } from "@/components/PhotoUpload";

import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const SWFL_CENTER: L.LatLngTuple = [26.6406, -81.8723];

const STATUS_COLORS = {
  lead: "#2EA3F2",
  sold: "#2C8214",
  follow_up: "#FFBF00",
} as const;

// Pins not knocked in this many days are considered "stale" and recolored
// to remind reps to either re-knock or move on.
const STALE_DAYS = 14;

function pinIcon(color: string, opts: { stale?: boolean; selected?: boolean } = {}) {
  const ring = opts.selected
    ? "box-shadow:0 0 0 3px #FFBF00, 0 2px 8px rgba(0,0,0,.5);"
    : "box-shadow:0 2px 6px rgba(0,0,0,.4);";
  const opacity = opts.stale ? 0.55 : 1;
  return L.divIcon({
    className: "jt-pin",
    html: `<div style="
      width:30px;height:30px;border-radius:50% 50% 50% 0;
      background:${color};transform:rotate(-45deg);
      border:3px solid #fff;${ring}
      opacity:${opacity};
      display:flex;align-items:center;justify-content:center;">
      <div style="width:10px;height:10px;border-radius:50%;background:#fff;transform:rotate(45deg);"></div>
    </div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -28],
  });
}

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

async function geocodeSearch(
  q: string,
): Promise<Array<{ lat: number; lon: number; display_name: string }>> {
  if (q.trim().length < 3) return [];
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5`,
      { headers: { Accept: "application/json" } },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as Array<{
      lat: string;
      lon: string;
      display_name: string;
    }>;
    return data.map((d) => ({
      lat: Number(d.lat),
      lon: Number(d.lon),
      display_name: d.display_name,
    }));
  } catch {
    return [];
  }
}

type ParsedBounds =
  | { kind: "polygon"; latlngs: L.LatLngTuple[] }
  | { kind: "rect"; sw: L.LatLngTuple; ne: L.LatLngTuple }
  | null;

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

function isStale(p: ApiPin): boolean {
  if (p.status === "sold") return false;
  const ref = p.lastKnockedAt ?? p.createdAt;
  const ms = Date.now() - new Date(ref).getTime();
  return ms > STALE_DAYS * 24 * 60 * 60 * 1000;
}

const TILE_LAYERS = {
  street: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "&copy; OpenStreetMap contributors",
    maxZoom: 19,
  },
  satellite: {
    // Esri World Imagery (free for non-commercial display use).
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution:
      "Imagery &copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community",
    maxZoom: 19,
  },
} as const;

export default function MapPage() {
  const qc = useQueryClient();
  const { data: pins } = useListPins();
  const { data: territories } = useListTerritories();
  const create = useCreatePin();
  const del = useDeletePin();
  const update = useUpdatePin();
  const skipTrace = useSkipTracePin();

  const [filter, setFilter] = useState<"all" | "lead" | "sold">("all");
  const [tileMode, setTileMode] = useState<"street" | "satellite">("street");
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<ApiPin | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<
    Array<{ lat: number; lon: number; display_name: string }>
  >([]);
  const [searching, setSearching] = useState(false);
  const [tracingId, setTracingId] = useState<number | null>(null);
  const [traceError, setTraceError] = useState<string | null>(null);
  const [form, setForm] = useState({
    address: "",
    latitude: SWFL_CENTER[0],
    longitude: SWFL_CENTER[1],
    notes: "",
    photoUrl: null as string | null,
    status: "lead" as "lead" | "sold",
    residentName: "",
    residentPhone: "",
  });

  const filtered = useMemo(
    () => (pins ?? []).filter((p) => filter === "all" || p.status === filter),
    [pins, filter],
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
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
    const tile = L.tileLayer(TILE_LAYERS.street.url, {
      attribution: TILE_LAYERS.street.attribution,
      maxZoom: TILE_LAYERS.street.maxZoom,
    }).addTo(map);
    tileLayerRef.current = tile;

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
        address: address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
        residentName: "",
        residentPhone: "",
      }));
      setOpen(true);
    });

    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 100);

    return () => {
      map.remove();
      mapRef.current = null;
      tileLayerRef.current = null;
      clusterRef.current = null;
      territoryLayerRef.current = null;
    };
  }, []);

  // Swap base tile layer when user toggles
  useEffect(() => {
    const map = mapRef.current;
    const old = tileLayerRef.current;
    if (!map || !old) return;
    const next = L.tileLayer(TILE_LAYERS[tileMode].url, {
      attribution: TILE_LAYERS[tileMode].attribution,
      maxZoom: TILE_LAYERS[tileMode].maxZoom,
    });
    next.addTo(map);
    map.removeLayer(old);
    tileLayerRef.current = next;
  }, [tileMode]);

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

  // Render markers — opens an in-app sheet on click instead of an HTML popup,
  // so taps on a home open a real component (better on mobile, can fire mutations
  // directly, and supports the new resident/phone view).
  useEffect(() => {
    const cluster = clusterRef.current;
    if (!cluster) return;
    cluster.clearLayers();
    filtered.forEach((p) => {
      const baseColor =
        STATUS_COLORS[p.status as keyof typeof STATUS_COLORS] ?? STATUS_COLORS.lead;
      const m = L.marker([p.latitude, p.longitude], {
        icon: pinIcon(baseColor, { stale: isStale(p) }),
      });
      m.on("click", () => {
        setDetail(p);
        setTraceError(null);
      });
      cluster.addLayer(m);
    });
  }, [filtered]);

  // Re-sync the detail sheet with the latest server data when pins refetch
  // (so after we mutate a pin, the open sheet stays current).
  useEffect(() => {
    if (!detail) return;
    const fresh = pins?.find((p) => p.id === detail.id);
    if (fresh && fresh !== detail) setDetail(fresh);
  }, [pins, detail]);

  // Debounced address search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      const r = await geocodeSearch(searchQuery);
      setSearchResults(r);
      setSearching(false);
    }, 350);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const handleSkipTrace = async (pinId: number) => {
    setTraceError(null);
    setTracingId(pinId);
    try {
      const r = await skipTrace.mutateAsync({ pinId });
      qc.invalidateQueries({ queryKey: getListPinsQueryKey() });
      if (r.source === "none") {
        setTraceError("No public phone match for this address.");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Lookup failed";
      setTraceError(msg);
    } finally {
      setTracingId(null);
    }
  };

  const handleMarkKnocked = async (pinId: number) => {
    await update.mutateAsync({ pinId, data: { markKnocked: true } });
    qc.invalidateQueries({ queryKey: getListPinsQueryKey() });
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6 lg:p-8">
      <BrandHeader
        title="Canvas Map"
        subtitle="Tap the map to drop a pin. Tap any pin to see resident info, knock history, and more."
        icon={<MapPin className="h-6 w-6" strokeWidth={1.5} />}
        actions={
          <div className="flex flex-wrap items-center gap-1.5">
            {(["all", "lead", "sold"] as const).map((f) => (
              <Button
                key={f}
                size="sm"
                variant={filter === f ? "default" : "outline"}
                onClick={() => setFilter(f)}
                className={cn(
                  "rounded-lg capitalize",
                  filter === f
                    ? "bg-[#2EA3F2] text-slate-950 hover:bg-[#48b3f6]"
                    : "border-border",
                )}
              >
                {f}
              </Button>
            ))}
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setTileMode((m) => (m === "street" ? "satellite" : "street"))
              }
              className="rounded-lg"
              title={
                tileMode === "street"
                  ? "Switch to satellite view"
                  : "Switch to street view"
              }
            >
              <Layers className="mr-1 h-3.5 w-3.5" />
              {tileMode === "street" ? "Satellite" : "Street"}
            </Button>
          </div>
        }
      />

      {/* Address search bar */}
      <Card className="p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search any address — fly to it on the map"
            className="pl-9 rounded-xl"
          />
          {searching && (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>
        {searchResults.length > 0 && (
          <div className="mt-2 divide-y divide-border rounded-lg border border-border">
            {searchResults.map((r) => (
              <button
                key={`${r.lat}-${r.lon}`}
                className="flex w-full items-start gap-2 p-2.5 text-left text-sm hover:bg-muted"
                onClick={() => {
                  mapRef.current?.flyTo([r.lat, r.lon], 18);
                  setSearchResults([]);
                  setSearchQuery("");
                }}
              >
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{r.display_name}</span>
              </button>
            ))}
          </div>
        )}
      </Card>

      {/* Drop-pin dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
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
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label>Resident name (optional)</Label>
                <Input
                  value={form.residentName}
                  onChange={(e) =>
                    setForm({ ...form, residentName: e.target.value })
                  }
                  placeholder="John Smith"
                  className="rounded-xl"
                />
              </div>
              <div>
                <Label>Resident phone (optional)</Label>
                <Input
                  value={form.residentPhone}
                  onChange={(e) =>
                    setForm({ ...form, residentPhone: e.target.value })
                  }
                  placeholder="(555) 123-4567"
                  className="rounded-xl"
                  inputMode="tel"
                />
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
                    residentName: form.residentName || null,
                    residentPhone: form.residentPhone || null,
                  },
                });
                setForm({
                  address: "",
                  latitude: SWFL_CENTER[0],
                  longitude: SWFL_CENTER[1],
                  notes: "",
                  photoUrl: null,
                  status: "lead",
                  residentName: "",
                  residentPhone: "",
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

      {/* House-detail sheet — opens when a pin is tapped */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="rounded-2xl max-h-[90vh] overflow-y-auto">
          {detail && (
            <PinDetail
              pin={detail}
              tracing={tracingId === detail.id}
              traceError={traceError}
              onTrace={() => handleSkipTrace(detail.id)}
              onMarkKnocked={() => handleMarkKnocked(detail.id)}
              onMarkSold={async () => {
                await update.mutateAsync({
                  pinId: detail.id,
                  data: { status: "sold" },
                });
                qc.invalidateQueries({ queryKey: getListPinsQueryKey() });
              }}
              onDelete={async () => {
                await del.mutateAsync({ pinId: detail.id });
                qc.invalidateQueries({ queryKey: getListPinsQueryKey() });
                setDetail(null);
              }}
              onSavePhone={async (residentName, residentPhone) => {
                await update.mutateAsync({
                  pinId: detail.id,
                  data: {
                    residentName: residentName || null,
                    residentPhone: residentPhone || null,
                  },
                });
                qc.invalidateQueries({ queryKey: getListPinsQueryKey() });
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <Card className="overflow-hidden">
        <div ref={containerRef} className="h-[480px] w-full" />
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((p) => {
          const photo = photoServingUrl(p.photoUrl);
          const stale = isStale(p);
          return (
            <Card key={p.id} className={cn("p-4", stale && "opacity-80")}>
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
                    {stale && (
                      <Badge variant="outline" className="text-[10px]">
                        stale
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(p.createdAt), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                  <div className="mt-1 truncate font-semibold text-sm">
                    {p.address}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <AvatarRing
                      src={p.repAvatarUrl}
                      name={p.repName}
                      accentColor={p.repAccentColor}
                      size={22}
                    />
                    <span>by {p.repName}</span>
                  </div>
                  {p.residentName && (
                    <div className="mt-1 flex items-center gap-1.5 text-xs">
                      <User className="h-3 w-3 text-muted-foreground" />
                      <span>{p.residentName}</span>
                    </div>
                  )}
                  {p.residentPhone && (
                    <a
                      href={`tel:${p.residentPhone}`}
                      className="mt-0.5 flex items-center gap-1.5 text-xs font-medium text-[#2EA3F2] hover:underline"
                    >
                      <Phone className="h-3 w-3" />
                      <span>{p.residentPhone}</span>
                    </a>
                  )}
                  {p.notes && <p className="mt-1 text-sm">{p.notes}</p>}
                  {photo && (
                    <img
                      src={photo}
                      alt=""
                      className="mt-2 h-24 w-full rounded-lg object-cover"
                    />
                  )}
                  <div className="mt-2 flex flex-wrap gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-xl"
                      onClick={() => {
                        mapRef.current?.flyTo([p.latitude, p.longitude], 18);
                        setDetail(p);
                      }}
                    >
                      Open
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

function PinDetail({
  pin,
  tracing,
  traceError,
  onTrace,
  onMarkKnocked,
  onMarkSold,
  onDelete,
  onSavePhone,
}: {
  pin: ApiPin;
  tracing: boolean;
  traceError: string | null;
  onTrace: () => void;
  onMarkKnocked: () => void;
  onMarkSold: () => void;
  onDelete: () => void;
  onSavePhone: (name: string, phone: string) => Promise<void> | void;
}) {
  const [editingPhone, setEditingPhone] = useState(false);
  const [name, setName] = useState(pin.residentName ?? "");
  const [phone, setPhone] = useState(pin.residentPhone ?? "");

  useEffect(() => {
    setName(pin.residentName ?? "");
    setPhone(pin.residentPhone ?? "");
    setEditingPhone(false);
  }, [pin.id, pin.residentName, pin.residentPhone]);

  const photo = photoServingUrl(pin.photoUrl);
  const lastKnockText = pin.lastKnockedAt
    ? `Last knocked ${formatDistanceToNow(new Date(pin.lastKnockedAt), { addSuffix: true })}`
    : "Never knocked";
  const directionsHref = `https://www.google.com/maps/dir/?api=1&destination=${pin.latitude},${pin.longitude}`;

  return (
    <div className="space-y-4">
      <DialogHeader>
        <DialogTitle className="text-base leading-snug">{pin.address}</DialogTitle>
      </DialogHeader>

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge
          className="text-white capitalize"
          style={{ backgroundColor: pin.status === "sold" ? "#2C8214" : "#2EA3F2" }}
        >
          {pin.status}
        </Badge>
        <span>by {pin.repName}</span>
        <span>·</span>
        <span>{lastKnockText}</span>
      </div>

      {/* Resident / phone block */}
      <div className="rounded-xl border border-border bg-card/50 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Resident
          </div>
          {pin.residentSource && (
            <Badge variant="outline" className="text-[10px]">
              {pin.residentSource === "rep" ? "from rep" : "skip-trace"}
            </Badge>
          )}
        </div>

        {editingPhone ? (
          <div className="space-y-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Resident name"
              className="rounded-xl"
            />
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(555) 123-4567"
              inputMode="tel"
              className="rounded-xl"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                className="rounded-xl"
                onClick={async () => {
                  await onSavePhone(name, phone);
                  setEditingPhone(false);
                }}
              >
                Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="rounded-xl"
                onClick={() => {
                  setName(pin.residentName ?? "");
                  setPhone(pin.residentPhone ?? "");
                  setEditingPhone(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <>
            {pin.residentName && (
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span>{pin.residentName}</span>
              </div>
            )}
            {pin.residentPhone ? (
              <a
                href={`tel:${pin.residentPhone}`}
                className="flex items-center gap-2 rounded-lg bg-[#2EA3F2]/10 px-2 py-1.5 text-sm font-semibold text-[#2EA3F2] hover:bg-[#2EA3F2]/20"
              >
                <Phone className="h-4 w-4" />
                <span>{pin.residentPhone}</span>
                <span className="ml-auto text-xs text-[#2EA3F2]/80">tap to call</span>
              </a>
            ) : (
              <p className="text-sm text-muted-foreground">No phone on file.</p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                className="rounded-xl"
                onClick={() => setEditingPhone(true)}
              >
                {pin.residentPhone ? "Edit" : "Add"} resident info
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="rounded-xl"
                onClick={onTrace}
                disabled={tracing}
              >
                {tracing ? (
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Search className="mr-1 h-3.5 w-3.5" />
                )}
                Look up phone
              </Button>
            </div>
            {traceError && (
              <p className="text-xs text-amber-500">{traceError}</p>
            )}
          </>
        )}
      </div>

      {pin.notes && <p className="text-sm">{pin.notes}</p>}
      {photo && (
        <img src={photo} alt="" className="h-40 w-full rounded-xl object-cover" />
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        <Button
          size="sm"
          variant="outline"
          className="rounded-xl"
          onClick={onMarkKnocked}
        >
          <DoorOpen className="mr-1 h-3.5 w-3.5" /> Knocked just now
        </Button>
        <a href={directionsHref} target="_blank" rel="noreferrer">
          <Button size="sm" variant="outline" className="rounded-xl">
            <Navigation className="mr-1 h-3.5 w-3.5" /> Directions
          </Button>
        </a>
        {pin.status === "lead" && (
          <Button
            size="sm"
            className="rounded-xl bg-[#2C8214] hover:bg-[#246910]"
            onClick={onMarkSold}
          >
            <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Mark sold
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="rounded-xl text-destructive hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
        </Button>
      </div>
    </div>
  );
}
