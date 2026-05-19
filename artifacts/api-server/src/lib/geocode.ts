import { db, geocodeCacheTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

export interface GeoHit {
  latitude: number;
  longitude: number;
  resolvedAddress: string;
}

function normalize(addr: string): string {
  return addr.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Lookup an address → lat/lng with a cheap DB cache layer in front of
 * Nominatim. Returns null when nothing matches. Nominatim's usage policy
 * forbids hammering — we cache aggressively (forever, until DB row is
 * deleted) and rate-limit to one request at a time.
 */
const queue: Array<() => Promise<void>> = [];
let pumping = false;
async function pump() {
  if (pumping) return;
  pumping = true;
  try {
    while (queue.length > 0) {
      const task = queue.shift()!;
      try {
        await task();
      } catch {
        /* per-task errors already logged */
      }
      // Be polite — Nominatim asks for ~1 rps max.
      await new Promise((r) => setTimeout(r, 1100));
    }
  } finally {
    pumping = false;
  }
}

export async function geocodeAddress(address: string): Promise<GeoHit | null> {
  const key = normalize(address);
  if (!key) return null;

  const [cached] = await db
    .select()
    .from(geocodeCacheTable)
    .where(eq(geocodeCacheTable.address, key))
    .limit(1);
  if (cached) {
    if (cached.latitude == null || cached.longitude == null) return null;
    return {
      latitude: cached.latitude,
      longitude: cached.longitude,
      resolvedAddress: cached.resolvedAddress ?? address,
    };
  }

  return new Promise<GeoHit | null>((resolve) => {
    queue.push(async () => {
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`;
        const res = await fetch(url, {
          headers: {
            Accept: "application/json",
            // Nominatim asks for a UA identifying the app. Include a contact
            // hint so they can reach us if we ever misbehave.
            "User-Agent": "JoshuaTreeSalesHub/1.0 (canvassing-map)",
          },
        });
        if (!res.ok) {
          logger.warn({ status: res.status, address }, "geocode: nominatim non-200");
          resolve(null);
          return;
        }
        const data = (await res.json()) as Array<{
          lat: string;
          lon: string;
          display_name: string;
        }>;
        const hit = data[0];
        if (!hit) {
          // Cache the miss so we don't re-hit the API for the same string.
          await db
            .insert(geocodeCacheTable)
            .values({
              address: key,
              latitude: null,
              longitude: null,
              resolvedAddress: null,
            })
            .onConflictDoNothing();
          resolve(null);
          return;
        }
        const out: GeoHit = {
          latitude: Number(hit.lat),
          longitude: Number(hit.lon),
          resolvedAddress: hit.display_name,
        };
        await db
          .insert(geocodeCacheTable)
          .values({
            address: key,
            latitude: out.latitude,
            longitude: out.longitude,
            resolvedAddress: out.resolvedAddress,
          })
          .onConflictDoNothing();
        resolve(out);
      } catch (err) {
        logger.warn({ err, address }, "geocode: lookup failed");
        resolve(null);
      }
    });
    void pump();
  });
}
