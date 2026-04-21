import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet-draw";
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

function parseBounds(b: string | null | undefined): L.LatLngTuple[] | null {
  if (!b) return null;
  try {
    const parsed = JSON.parse(b);
    if (parsed?.type === "Polygon" && Array.isArray(parsed.coordinates?.[0])) {
      return (parsed.coordinates[0] as [number, number][]).map(
        ([lng, lat]) => [lat, lng] as L.LatLngTuple,
      );
    }
  } catch {
    /* legacy free-text */
  }
  return null;
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

    map.on((L as any).Draw.Event.CREATED, (e: any) => {
      drawnItems.clearLayers();
      drawnItems.addLayer(e.layer as L.Polygon);
      reportFromDrawn();
    });
    map.on((L as any).Draw.Event.EDITED, () => {
      reportFromDrawn();
    });
    map.on((L as any).Draw.Event.DELETED, () => {
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
    const control = new (L as any).Control.Draw({
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
    }) as L.Control;
    map.addControl(control);
    drawControlRef.current = control;
  }, [drawColor]);

  // Render existing polygons
  useEffect(() => {
    const layer = existingLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    territories.forEach((t) => {
      const coords = parseBounds(t.bounds);
      if (!coords || coords.length < 3) return;
      L.polygon(coords, {
        color: t.color,
        weight: 2,
        fillColor: t.color,
        fillOpacity: 0.15,
      })
        .bindTooltip(t.name, { sticky: true })
        .addTo(layer);
    });
  }, [territories]);

  return <div ref={containerRef} className="h-[420px] w-full rounded-xl overflow-hidden" />;
}
