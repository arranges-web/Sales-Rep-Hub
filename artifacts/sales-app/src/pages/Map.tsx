import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet.markercluster";
// Pin the explicit file path — leaflet.heat ships no `exports` field, so
// Vite's default resolution can fail in some module-graph configurations.
import "leaflet.heat/dist/leaflet-heat.js";
import type {} from "leaflet.markercluster";
import { findHotspots, HOTSPOT_TYPE_META, type Hotspot } from "@/lib/opportunity";
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
  DoorOpen,
  Navigation,
  Loader2,
  Hash,
  Plus,
  Crosshair,
  Flame,
  Target,
  TrendingUp,
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

// Zoom high enough that OSM standard tiles render house numbers / address tags.
const HOUSE_ZOOM = 19;

function pinIcon(
  color: string,
  opts: { stale?: boolean; selected?: boolean; status?: string } = {},
) {
  const ring = opts.selected
    ? "box-shadow:0 0 0 3px #FFBF00, 0 4px 14px rgba(0,0,0,.55);"
    : "box-shadow:0 4px 12px rgba(0,0,0,.45);";
  const opacity = opts.stale ? 0.55 : 1;
  const inner =
    opts.status === "sold"
      ? `<svg viewBox="0 0 24 24" width="11" height="11" stroke="${color}" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>`
      : `<div style="width:8px;height:8px;border-radius:50%;background:${color};"></div>`;
  return L.divIcon({
    className: "jt-pin",
    html: `<div style="position:relative;width:32px;height:42px;">
      <div style="
        position:absolute;left:1px;top:0;width:30px;height:30px;
        border-radius:50% 50% 50% 0;
        background:${color};transform:rotate(-45deg);
        border:2.5px solid #fff;${ring}
        opacity:${opacity};
        display:flex;align-items:center;justify-content:center;">
        <div style="transform:rotate(45deg);display:flex;align-items:center;justify-content:center;background:#fff;width:14px;height:14px;border-radius:50%;">${inner}</div>
      </div>
    </div>`,
    iconSize: [32, 42],
    iconAnchor: [16, 38],
    popupAnchor: [0, -34],
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

type TileMode = "street" | "hybrid" | "satellite";

const STREET_LAYER = {
  url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution: "&copy; OpenStreetMap contributors",
  maxZoom: 19,
};

const SAT_LAYER = {
  url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  attribution:
    "Imagery &copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community",
  maxZoom: 19,
};

// Transparent overlay layers — when stacked on satellite imagery they paint in
// roads, place names, and (at high zoom) house numbers without blocking pixels.
const SAT_TRANSPORT_OVERLAY = {
  url: "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}",
  attribution: "Roads &copy; Esri",
  maxZoom: 19,
};

const SAT_PLACES_OVERLAY = {
  url: "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
  attribution: "Places &copy; Esri",
  maxZoom: 19,
};

export default function MapPage() {
  const qc = useQueryClient();
  const { data: pins } = useListPins();
  const { data: territories } = useListTerritories();
  const create = useCreatePin();
  const del = useDeletePin();
  const update = useUpdatePin();
  const skipTrace = useSkipTracePin();

  const [filter, setFilter] = useState<"all" | "lead" | "sold">("all");
  const [tileMode, setTileMode] = useState<TileMode>("hybrid");
  const [showHouseNumbers, setShowHouseNumbers] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showHotspots, setShowHotspots] = useState(true);
  const [hotspotsOpen, setHotspotsOpen] = useState(false);
  const [activeHotspot, setActiveHotspot] = useState<string | null>(null);
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

  const counts = useMemo(() => {
    const all = pins ?? [];
    const leads = all.filter((p) => p.status === "lead").length;
    const sold = all.filter((p) => p.status === "sold").length;
    const stale = all.filter((p) => isStale(p)).length;
    return { all: all.length, leads, sold, stale };
  }, [pins]);

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const baseLayerRef = useRef<L.TileLayer | null>(null);
  const transportOverlayRef = useRef<L.TileLayer | null>(null);
  const placesOverlayRef = useRef<L.TileLayer | null>(null);
  const houseNumOverlayRef = useRef<L.TileLayer | null>(null);
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const territoryLayerRef = useRef<L.LayerGroup | null>(null);
  const heatLayerRef = useRef<L.HeatLayer | null>(null);
  const hotspotsLayerRef = useRef<L.LayerGroup | null>(null);

  const hotspots = useMemo(() => findHotspots(pins).slice(0, 10), [pins]);

  // Init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: SWFL_CENTER,
      zoom: 11,
      scrollWheelZoom: true,
      zoomControl: false,
    });
    L.control.zoom({ position: "bottomright" }).addTo(map);

    // Default base = street; we'll swap in the tile-mode effect below.
    const base = L.tileLayer(STREET_LAYER.url, {
      attribution: STREET_LAYER.attribution,
      maxZoom: STREET_LAYER.maxZoom,
    }).addTo(map);
    baseLayerRef.current = base;

    const cluster = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 50,
      iconCreateFunction: (c) => {
        const n = c.getChildCount();
        return L.divIcon({
          className: "jt-cluster",
          html: `<div style="
            width:42px;height:42px;border-radius:50%;
            background:linear-gradient(135deg,#2EA3F2,#1d8fd8);
            color:white;font-weight:700;font-size:13px;
            display:flex;align-items:center;justify-content:center;
            border:3px solid rgba(255,255,255,.9);
            box-shadow:0 4px 14px rgba(46,163,242,.5);">${n}</div>`,
          iconSize: [42, 42],
        });
      },
    });
    map.addLayer(cluster);
    clusterRef.current = cluster;

    const territoryLayer = L.layerGroup().addTo(map);
    territoryLayerRef.current = territoryLayer;

    // Hotspot rectangles live below pins so taps still fall through to markers.
    const hotspotsLayer = L.layerGroup().addTo(map);
    hotspotsLayerRef.current = hotspotsLayer;

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
      baseLayerRef.current = null;
      transportOverlayRef.current = null;
      placesOverlayRef.current = null;
      houseNumOverlayRef.current = null;
      clusterRef.current = null;
      territoryLayerRef.current = null;
      hotspotsLayerRef.current = null;
      heatLayerRef.current = null;
    };
  }, []);

  // Heatmap layer — rebuild whenever pins change or visibility toggles.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (heatLayerRef.current) {
      map.removeLayer(heatLayerRef.current);
      heatLayerRef.current = null;
    }
    if (!showHeatmap || !pins || pins.length === 0) return;
    // Weight sold pins heavier so the heat reveals proven blocks.
    const points: Array<[number, number, number]> = pins.map((p) => [
      p.latitude,
      p.longitude,
      p.status === "sold" ? 1.0 : 0.55,
    ]);
    const layer = L.heatLayer(points, {
      radius: 28,
      blur: 22,
      maxZoom: 17,
      minOpacity: 0.35,
      gradient: {
        0.2: "#2EA3F2",
        0.45: "#48b3f6",
        0.7: "#FFBF00",
        0.9: "#ff7a2d",
        1.0: "#ef4444",
      },
    });
    layer.addTo(map);
    heatLayerRef.current = layer;
  }, [showHeatmap, pins]);

  // Hotspot rectangles — render the top opportunity cells over the map.
  useEffect(() => {
    const layer = hotspotsLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    if (!showHotspots) return;
    hotspots.forEach((h, i) => {
      const meta = HOTSPOT_TYPE_META[h.type];
      const isActive = activeHotspot === h.key;
      const rank = i + 1;
      L.rectangle(
        [
          [h.south, h.west],
          [h.north, h.east],
        ],
        {
          color: meta.color,
          weight: isActive ? 3 : 1.5,
          opacity: isActive ? 0.95 : 0.65,
          fillColor: meta.color,
          fillOpacity: isActive ? 0.22 : 0.1,
          interactive: false,
        },
      ).addTo(layer);

      // Rank tag at the cell centroid — make the top hotspots scannable
      // even when zoomed out.
      const tag = L.divIcon({
        className: "jt-hotspot-tag",
        html: `<div style="
            display:flex;align-items:center;gap:4px;
            padding:2px 8px;border-radius:999px;
            background:${meta.color};color:#0c1219;
            font-weight:800;font-size:11px;letter-spacing:.02em;
            box-shadow:0 4px 14px rgba(0,0,0,.45);
            border:1.5px solid rgba(255,255,255,.85);
            white-space:nowrap;">
            <span>#${rank}</span>
            <span style="opacity:.75;font-weight:700">${meta.label}</span>
          </div>`,
        iconSize: [80, 22],
        iconAnchor: [40, 11],
      });
      L.marker([h.centerLat, h.centerLng], {
        icon: tag,
        interactive: true,
        keyboard: false,
        bubblingMouseEvents: false,
      })
        .on("click", () => {
          setActiveHotspot(h.key);
          setHotspotsOpen(true);
        })
        .addTo(layer);
    });
  }, [hotspots, showHotspots, activeHotspot]);

  // Apply tile mode + overlays whenever they change. We tear down and rebuild
  // the relevant layers so each mode is exactly what it should be.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove old base
    if (baseLayerRef.current) {
      map.removeLayer(baseLayerRef.current);
      baseLayerRef.current = null;
    }
    if (transportOverlayRef.current) {
      map.removeLayer(transportOverlayRef.current);
      transportOverlayRef.current = null;
    }
    if (placesOverlayRef.current) {
      map.removeLayer(placesOverlayRef.current);
      placesOverlayRef.current = null;
    }
    if (houseNumOverlayRef.current) {
      map.removeLayer(houseNumOverlayRef.current);
      houseNumOverlayRef.current = null;
    }

    // Choose base imagery
    if (tileMode === "street") {
      baseLayerRef.current = L.tileLayer(STREET_LAYER.url, {
        attribution: STREET_LAYER.attribution,
        maxZoom: STREET_LAYER.maxZoom,
      }).addTo(map);
    } else {
      baseLayerRef.current = L.tileLayer(SAT_LAYER.url, {
        attribution: SAT_LAYER.attribution,
        maxZoom: SAT_LAYER.maxZoom,
      }).addTo(map);

      if (tileMode === "hybrid") {
        transportOverlayRef.current = L.tileLayer(SAT_TRANSPORT_OVERLAY.url, {
          attribution: SAT_TRANSPORT_OVERLAY.attribution,
          maxZoom: SAT_TRANSPORT_OVERLAY.maxZoom,
        }).addTo(map);
        placesOverlayRef.current = L.tileLayer(SAT_PLACES_OVERLAY.url, {
          attribution: SAT_PLACES_OVERLAY.attribution,
          maxZoom: SAT_PLACES_OVERLAY.maxZoom,
        }).addTo(map);
      }
    }

    // House-number overlay: standard OSM tiles painted at low opacity over
    // imagery. Esri's reference layer doesn't expose individual address
    // numbers, but OSM standard tiles do at zoom ≥18 — overlaying them gives
    // reps the address tags they need without losing the satellite pixels.
    if (showHouseNumbers && tileMode !== "street") {
      const houseNum = L.tileLayer(STREET_LAYER.url, {
        attribution: STREET_LAYER.attribution,
        maxZoom: STREET_LAYER.maxZoom,
        opacity: 0.35,
        // Only kick in at street-level zooms so we don't muddy the satellite
        // view at city-wide scales.
        minZoom: 17,
      }).addTo(map);
      houseNumOverlayRef.current = houseNum;
    }
  }, [tileMode, showHouseNumbers]);

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
        icon: pinIcon(baseColor, { stale: isStale(p), status: p.status }),
      });
      m.on("click", () => {
        setDetail(p);
        setTraceError(null);
        // Slide the camera in close enough that house numbers render.
        mapRef.current?.flyTo([p.latitude, p.longitude], HOUSE_ZOOM, {
          duration: 0.5,
        });
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

  const flyToHotspot = (h: Hotspot) => {
    const map = mapRef.current;
    if (!map) return;
    setActiveHotspot(h.key);
    map.fitBounds(
      [
        [h.south, h.west],
        [h.north, h.east],
      ],
      { padding: [40, 40], maxZoom: 18, duration: 0.6, animate: true },
    );
  };

  const goToMyLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        mapRef.current?.flyTo(
          [pos.coords.latitude, pos.coords.longitude],
          HOUSE_ZOOM,
          { duration: 0.6 },
        );
      },
      () => {},
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6 lg:p-8">
      <BrandHeader
        title="Canvas Map"
        subtitle="Tap any house for resident info & phone. Switch to satellite to scout the property before you knock."
        icon={<MapPin className="h-6 w-6" strokeWidth={1.5} />}
        actions={
          <div className="flex flex-wrap items-center gap-1.5">
            <CountChip label="Leads" value={counts.leads} color="#2EA3F2" />
            <CountChip label="Sold" value={counts.sold} color="#2C8214" />
            {counts.stale > 0 && (
              <CountChip label="Stale" value={counts.stale} color="#FFBF00" />
            )}
          </div>
        }
      />

      {/* Address search bar */}
      <Card className="p-3 transition-colors duration-200 hover:border-[#2EA3F2]/40">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search any address — fly straight to it"
            className="rounded-xl pl-9 pr-9"
          />
          {searching && (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>
        {searchResults.length > 0 && (
          <div className="mt-2 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card/80 backdrop-blur">
            {searchResults.map((r) => (
              <button
                key={`${r.lat}-${r.lon}`}
                className="flex w-full items-start gap-2 p-2.5 text-left text-sm transition-colors hover:bg-muted"
                onClick={() => {
                  mapRef.current?.flyTo([r.lat, r.lon], HOUSE_ZOOM, {
                    duration: 0.6,
                  });
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
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl">
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
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl">
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

      {/* Map area with floating glass controls */}
      <Card className="relative overflow-hidden border-border/80 shadow-lg">
        <div
          ref={containerRef}
          className="h-[60vh] min-h-[420px] w-full sm:h-[68vh]"
        />

        {/* Top-left: tile mode + house numbers */}
        <div className="pointer-events-none absolute left-3 top-3 z-[500] flex max-w-[calc(100%-1.5rem)] flex-col gap-2">
          <div className="pointer-events-auto inline-flex rounded-full border border-white/10 bg-slate-950/70 p-1 text-xs font-medium text-slate-100 shadow-xl backdrop-blur-md">
            {(
              [
                { k: "street", label: "Street" },
                { k: "hybrid", label: "Hybrid" },
                { k: "satellite", label: "Satellite" },
              ] as Array<{ k: TileMode; label: string }>
            ).map((m) => (
              <button
                key={m.k}
                onClick={() => setTileMode(m.k)}
                className={cn(
                  "rounded-full px-3 py-1.5 transition-colors",
                  tileMode === m.k
                    ? "bg-[#2EA3F2] text-slate-950"
                    : "text-slate-200 hover:text-white",
                )}
              >
                {m.label}
              </button>
            ))}
          </div>

          {tileMode !== "street" && (
            <button
              onClick={() => setShowHouseNumbers((v) => !v)}
              className={cn(
                "pointer-events-auto inline-flex w-fit items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-xs font-medium shadow-xl backdrop-blur-md transition-colors",
                showHouseNumbers
                  ? "bg-[#2EA3F2] text-slate-950"
                  : "bg-slate-950/70 text-slate-100 hover:bg-slate-900/80",
              )}
              title="Overlay OpenStreetMap address numbers on satellite imagery"
            >
              <Hash className="h-3.5 w-3.5" />
              House numbers {showHouseNumbers ? "on" : "off"}
            </button>
          )}
          <button
            onClick={() => setShowHeatmap((v) => !v)}
            className={cn(
              "pointer-events-auto inline-flex w-fit items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-xs font-medium shadow-xl backdrop-blur-md transition-colors",
              showHeatmap
                ? "bg-[#ff7a2d] text-slate-950"
                : "bg-slate-950/70 text-slate-100 hover:bg-slate-900/80",
            )}
            title="Show density heatmap of pins"
          >
            <Flame className="h-3.5 w-3.5" />
            Heatmap {showHeatmap ? "on" : "off"}
          </button>
          <button
            onClick={() => setShowHotspots((v) => !v)}
            className={cn(
              "pointer-events-auto inline-flex w-fit items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-xs font-medium shadow-xl backdrop-blur-md transition-colors",
              showHotspots
                ? "bg-[#FFBF00] text-slate-950"
                : "bg-slate-950/70 text-slate-100 hover:bg-slate-900/80",
            )}
            title="Highlight the top opportunity blocks"
          >
            <Target className="h-3.5 w-3.5" />
            Hotspots {showHotspots ? "on" : "off"}
          </button>
        </div>

        {/* Top-right: filter chips */}
        <div className="pointer-events-none absolute right-3 top-3 z-[500] flex flex-wrap justify-end gap-1.5">
          {(["all", "lead", "sold"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "pointer-events-auto rounded-full border px-3 py-1.5 text-xs font-semibold capitalize shadow-xl backdrop-blur-md transition-colors",
                filter === f
                  ? "border-transparent bg-[#2EA3F2] text-slate-950"
                  : "border-white/10 bg-slate-950/70 text-slate-100 hover:bg-slate-900/80",
              )}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Bottom-left: legend */}
        <div className="pointer-events-none absolute bottom-3 left-3 z-[500] flex items-center gap-3 rounded-full border border-white/10 bg-slate-950/70 px-3 py-1.5 text-[11px] text-slate-200 shadow-xl backdrop-blur-md">
          <Legend color="#2EA3F2" label="Lead" />
          <Legend color="#2C8214" label="Sold" />
          <Legend color="#FFBF00" label="Stale" muted />
        </div>

        {/* Bottom-right: floating action buttons */}
        <div className="pointer-events-none absolute bottom-20 right-3 z-[500] flex flex-col gap-2">
          {hotspots.length > 0 && (
            <Button
              size="icon"
              className="pointer-events-auto h-11 w-11 rounded-full bg-[#FFBF00] text-slate-950 shadow-xl shadow-[#FFBF00]/40 hover:bg-[#ffcd33]"
              onClick={() => {
                flyToHotspot(hotspots[0]!);
                setHotspotsOpen(true);
              }}
              title={`Fly to top hotspot — ${hotspots[0]!.label}`}
            >
              <Flame className="h-4 w-4" />
            </Button>
          )}
          <Button
            size="icon"
            className="pointer-events-auto h-11 w-11 rounded-full bg-slate-950/80 text-slate-100 shadow-xl backdrop-blur-md hover:bg-slate-900"
            variant="ghost"
            onClick={goToMyLocation}
            title="Center on my location"
          >
            <Crosshair className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            className="pointer-events-auto h-12 w-12 rounded-full bg-[#2EA3F2] text-slate-950 shadow-2xl shadow-[#2EA3F2]/40 hover:bg-[#48b3f6]"
            onClick={() => {
              const c = mapRef.current?.getCenter() ?? {
                lat: SWFL_CENTER[0],
                lng: SWFL_CENTER[1],
              };
              setForm((f) => ({
                ...f,
                latitude: Number(c.lat.toFixed(6)),
                longitude: Number(c.lng.toFixed(6)),
                address: "",
              }));
              setOpen(true);
            }}
            title="Drop a pin at center"
          >
            <Plus className="h-5 w-5" strokeWidth={2.5} />
          </Button>
        </div>

        {/* Hotspots panel — slide-in from the right */}
        {hotspotsOpen && (
          <div className="pointer-events-auto absolute right-3 top-16 z-[600] flex max-h-[calc(100%-7rem)] w-[300px] max-w-[calc(100%-1.5rem)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-950/85 text-slate-100 shadow-2xl backdrop-blur-md">
            <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2.5">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider">
                <TrendingUp className="h-3.5 w-3.5 text-[#FFBF00]" />
                Top hotspots
              </div>
              <button
                onClick={() => setHotspotsOpen(false)}
                className="rounded-full p-1 text-slate-300 hover:bg-white/10"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="overflow-y-auto p-2">
              {hotspots.length === 0 ? (
                <p className="p-2 text-xs text-slate-400">
                  Drop a few pins and we'll surface the highest-opportunity blocks.
                </p>
              ) : (
                hotspots.map((h, i) => {
                  const meta = HOTSPOT_TYPE_META[h.type];
                  const active = activeHotspot === h.key;
                  return (
                    <button
                      key={h.key}
                      onClick={() => flyToHotspot(h)}
                      className={cn(
                        "mb-1.5 flex w-full items-start gap-2 rounded-xl border p-2.5 text-left transition-colors",
                        active
                          ? "border-[#FFBF00]/50 bg-[#FFBF00]/10"
                          : "border-white/5 bg-white/5 hover:bg-white/10",
                      )}
                    >
                      <div
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold text-slate-950"
                        style={{ background: meta.color }}
                      >
                        {i + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-semibold">
                            {h.label}
                          </span>
                          <span
                            className="rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
                            style={{
                              color: meta.color,
                              background: `${meta.color}22`,
                            }}
                          >
                            {meta.label}
                          </span>
                        </div>
                        <div className="mt-0.5 text-[11px] leading-snug text-slate-300">
                          {h.reason}
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-400">
                          <span>{h.leadCount} leads</span>
                          <span>·</span>
                          <span>{h.soldCount} sold</span>
                          <span>·</span>
                          <span className="font-stat font-bold text-slate-200">
                            score {h.score.toFixed(1)}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Persistent "Show hotspots" tab when panel closed */}
        {!hotspotsOpen && hotspots.length > 0 && (
          <button
            onClick={() => setHotspotsOpen(true)}
            className="pointer-events-auto absolute right-3 top-16 z-[600] inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-slate-950/80 px-3 py-1.5 text-xs font-semibold text-slate-100 shadow-xl backdrop-blur-md hover:bg-slate-900"
          >
            <TrendingUp className="h-3.5 w-3.5 text-[#FFBF00]" />
            {hotspots.length} hotspot{hotspots.length === 1 ? "" : "s"}
          </button>
        )}
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((p) => {
          const photo = photoServingUrl(p.photoUrl);
          const stale = isStale(p);
          return (
            <Card
              key={p.id}
              className={cn(
                "p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#2EA3F2]/40 hover:shadow-lg",
                stale && "opacity-80",
              )}
            >
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
                        mapRef.current?.flyTo(
                          [p.latitude, p.longitude],
                          HOUSE_ZOOM,
                          { duration: 0.5 },
                        );
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

function CountChip({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-2.5 py-1 text-xs">
      <span
        aria-hidden
        className="inline-block h-2 w-2 rounded-full"
        style={{ background: color }}
      />
      <span className="text-muted-foreground">{label}</span>
      <span className="font-stat text-sm font-bold" style={{ color }}>
        {value}
      </span>
    </div>
  );
}

function Legend({
  color,
  label,
  muted = false,
}: {
  color: string;
  label: string;
  muted?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", muted && "opacity-90")}>
      <span
        aria-hidden
        className="inline-block h-2 w-2 rounded-full"
        style={{
          background: color,
          boxShadow: `0 0 0 1.5px rgba(255,255,255,.85)`,
        }}
      />
      {label}
    </span>
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
      <div className="space-y-2 rounded-xl border border-border bg-card/50 p-3">
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
                className="flex items-center gap-2 rounded-lg bg-[#2EA3F2]/10 px-2 py-1.5 text-sm font-semibold text-[#2EA3F2] transition-colors hover:bg-[#2EA3F2]/20"
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

