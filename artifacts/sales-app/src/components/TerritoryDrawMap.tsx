import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet-draw";
import type {} from "leaflet-draw";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const SWFL_CENTER: L.LatLngTuple = [26.6406, -81.8723];

export interface TerritoryShape {
  id: number;
  name: string;
  color: string;
  bounds?: string | null;
}

interface Props {
  territories: TerritoryShape[];
  drawColor: string;
  onPolygonDrawn: (geojson: string | null) => void;
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
    /* fall through to legacy */
  }
  return parseLegacyRect(b);
}

function layerToGeoJson(layer: L.Polygon): string {
  const latlngs = (layer.getLatLngs()[0] as L.LatLng[]).map(
    (ll) => [ll.lng, ll.lat] as [number, number],
  );
  if (latlngs.length > 0) {
    const first = latlngs[0]!;
    const last = latlngs[latlngs.length - 1]!;
    if (first[0] !== last[0] || first[1] !== last[1]) latlngs.push(first);
  }
  return JSON.stringify({ type: "Polygon", coordinates: [latlngs] });
}

export function TerritoryDrawMap({ territories, drawColor, onPolygonDrawn }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const drawnItemsRef = useRef<L.FeatureGroup | null>(null);
  const existingLayerRef = useRef<L.LayerGroup | null>(null);
  const drawControlRef = useRef<L.Control | null>(null);

  // Hold latest callback in a ref so init effect deps stay empty
  const onPolygonDrawnRef = useRef(onPolygonDrawn);
  useEffect(() => {
    onPolygonDrawnRef.current = onPolygonDrawn;
  }, [onPolygonDrawn]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: SWFL_CENTER,
      zoom: 11,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);

    const existingLayer = L.layerGroup().addTo(map);
    existingLayerRef.current = existingLayer;

    const drawnItems = new L.FeatureGroup().addTo(map);
    drawnItemsRef.current = drawnItems;

    const reportFromDrawn = () => {
      const layers = drawnItems.getLayers();
      if (layers.length === 0) {
        onPolygonDrawnRef.current(null);
      } else {
        onPolygonDrawnRef.current(layerToGeoJson(layers[0] as L.Polygon));
      }
    };

    map.on(L.Draw.Event.CREATED, (e) => {
      drawnItems.clearLayers();
      const event = e as L.LeafletEvent & { layer: L.Layer };
      drawnItems.addLayer(event.layer);
      reportFromDrawn();
    });
    map.on(L.Draw.Event.EDITED, () => {
      reportFromDrawn();
    });
    map.on(L.Draw.Event.DELETED, () => {
      reportFromDrawn();
    });

    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 100);

    return () => {
      map.remove();
      mapRef.current = null;
      drawnItemsRef.current = null;
      existingLayerRef.current = null;
      drawControlRef.current = null;
    };
  }, []);

  // Re-create draw control when color changes
  useEffect(() => {
    const map = mapRef.current;
    const drawnItems = drawnItemsRef.current;
    if (!map || !drawnItems) return;
    if (drawControlRef.current) map.removeControl(drawControlRef.current);
    const control = new L.Control.Draw({
      position: "topright",
      draw: {
        polygon: {
          allowIntersection: false,
          showArea: true,
          shapeOptions: { color: drawColor, weight: 2, fillOpacity: 0.2 },
        },
        polyline: false,
        rectangle: false,
        circle: false,
        marker: false,
        circlemarker: false,
      },
      edit: { featureGroup: drawnItems, remove: true },
    });
    map.addControl(control);
    drawControlRef.current = control;
  }, [drawColor]);

  // Render existing polygons
  useEffect(() => {
    const layer = existingLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    territories.forEach((t) => {
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

  return <div ref={containerRef} className="h-[420px] w-full rounded-xl overflow-hidden" />;
}
