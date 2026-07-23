import type { MapPin } from "@workspace/api-client-react";

// Roughly 400m at SWFL latitudes (cos(26°) ≈ 0.9). Tight enough to keep a
// hotspot to a couple of blocks, loose enough to absorb GPS jitter.
const GRID_SIZE_DEG = 0.004;

const STALE_DAYS = 14;

export type HotspotType = "goldmine" | "pipeline" | "cold" | "warm";

export interface Hotspot {
  /** Stable key derived from the grid cell. */
  key: string;
  /** Centroid lat/lng — used for the fly-to. */
  centerLat: number;
  centerLng: number;
  /** Tight bounds around the cell, useful for fitBounds(). */
  south: number;
  west: number;
  north: number;
  east: number;
  pins: MapPin[];
  leadCount: number;
  soldCount: number;
  staleLeadCount: number;
  soldRatio: number;
  /** Score used for ranking. Higher = better opportunity. */
  score: number;
  /** Friendly label — last pin's address up to the comma. */
  label: string;
  /** Plain-English reason this scored well. */
  reason: string;
  type: HotspotType;
}

function quantize(value: number, step: number): number {
  return Math.floor(value / step) * step;
}

function daysSince(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 86_400_000;
}

function isStale(p: MapPin): boolean {
  if (p.status === "sold") return false;
  return daysSince(p.lastKnockedAt ?? p.createdAt) > STALE_DAYS;
}

function shortAddress(p: MapPin | undefined): string {
  if (!p) return "Unnamed area";
  const head = p.address.split(",")[0]?.trim();
  return head || p.address;
}

function reasonFor(h: Omit<Hotspot, "reason" | "type">): {
  reason: string;
  type: HotspotType;
} {
  if (h.soldCount >= 2 && h.soldRatio >= 0.25) {
    return {
      type: "goldmine",
      reason: `${h.soldCount} sold here — the block converts. Hit the leads on the same street.`,
    };
  }
  if (h.soldCount > 0) {
    return {
      type: "warm",
      reason: `${h.soldCount} sold + ${h.leadCount} open lead${h.leadCount === 1 ? "" : "s"} nearby.`,
    };
  }
  if (h.leadCount >= 3) {
    return {
      type: "pipeline",
      reason: `${h.leadCount} unresolved lead${h.leadCount === 1 ? "" : "s"}${
        h.staleLeadCount > 0 ? ` — ${h.staleLeadCount} stale, ripe to re-knock` : ""
      }.`,
    };
  }
  if (h.staleLeadCount > 0) {
    return {
      type: "cold",
      reason: `${h.staleLeadCount} stale lead${h.staleLeadCount === 1 ? "" : "s"} — overdue follow-up.`,
    };
  }
  return {
    type: "pipeline",
    reason: `${h.leadCount + h.soldCount} pin${h.leadCount + h.soldCount === 1 ? "" : "s"} in this block.`,
  };
}

/**
 * Group pins into geographic grid cells and rank by opportunity score.
 *
 * Scoring favors blocks that have already converted (proven buyers) and
 * still have unresolved leads to knock — the "warm" territory that turns
 * a canvassing day into a closing day.
 */
export function findHotspots(pins: MapPin[] | undefined): Hotspot[] {
  if (!pins || pins.length === 0) return [];
  type Bucket = {
    south: number;
    west: number;
    pins: MapPin[];
  };
  const buckets = new Map<string, Bucket>();
  for (const p of pins) {
    const south = quantize(p.latitude, GRID_SIZE_DEG);
    const west = quantize(p.longitude, GRID_SIZE_DEG);
    const key = `${south.toFixed(4)}_${west.toFixed(4)}`;
    const b = buckets.get(key);
    if (b) b.pins.push(p);
    else buckets.set(key, { south, west, pins: [p] });
  }

  const out: Hotspot[] = [];
  for (const [key, b] of buckets) {
    const leadCount = b.pins.filter((p) => p.status === "lead").length;
    const soldCount = b.pins.filter((p) => p.status === "sold").length;
    const staleLeadCount = b.pins.filter(
      (p) => p.status === "lead" && isStale(p),
    ).length;
    const total = b.pins.length;
    const soldRatio = total === 0 ? 0 : soldCount / total;

    const score =
      soldCount * 4 +
      leadCount * 1.2 +
      staleLeadCount * 0.8 +
      soldRatio * 10 +
      Math.min(total, 8) * 0.5;

    const centerLat =
      b.pins.reduce((s, p) => s + p.latitude, 0) / total;
    const centerLng =
      b.pins.reduce((s, p) => s + p.longitude, 0) / total;
    const newest = [...b.pins].sort(
      (a, c) => +new Date(c.createdAt) - +new Date(a.createdAt),
    )[0];

    const partial = {
      key,
      centerLat,
      centerLng,
      south: b.south,
      west: b.west,
      north: b.south + GRID_SIZE_DEG,
      east: b.west + GRID_SIZE_DEG,
      pins: b.pins,
      leadCount,
      soldCount,
      staleLeadCount,
      soldRatio,
      score,
      label: shortAddress(newest),
    };
    const { reason, type } = reasonFor(partial);
    out.push({ ...partial, reason, type });
  }

  return out.sort((a, b) => b.score - a.score);
}

export const HOTSPOT_TYPE_META: Record<
  HotspotType,
  { label: string; color: string; description: string }
> = {
  goldmine: {
    label: "Goldmine",
    color: "#FFBF00",
    description: "Proven block — high conversion rate, more leads to close.",
  },
  warm: {
    label: "Warm",
    color: "#2C8214",
    description: "Mixed sold + leads — closes are happening here.",
  },
  pipeline: {
    label: "Pipeline",
    color: "#14B8A6",
    description: "Lots of leads, not yet converted — go work them.",
  },
  cold: {
    label: "Follow-up",
    color: "#a78bfa",
    description: "Stale leads — overdue for a re-knock.",
  },
};
