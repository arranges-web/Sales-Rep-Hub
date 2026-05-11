// Minimal types for leaflet.heat — the upstream package ships no .d.ts.
declare module "leaflet.heat" {
  // Side-effect import: attaches L.heatLayer to the leaflet namespace.
}

import "leaflet";

declare module "leaflet" {
  interface HeatLayerOptions {
    minOpacity?: number;
    maxZoom?: number;
    max?: number;
    radius?: number;
    blur?: number;
    gradient?: Record<number, string>;
  }

  type HeatLatLng = [number, number] | [number, number, number];

  interface HeatLayer extends Layer {
    setLatLngs(latlngs: HeatLatLng[]): this;
    addLatLng(latlng: HeatLatLng): this;
    setOptions(options: HeatLayerOptions): this;
    redraw(): this;
  }

  function heatLayer(latlngs: HeatLatLng[], options?: HeatLayerOptions): HeatLayer;
}
