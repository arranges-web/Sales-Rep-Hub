import type { Badge } from "@workspace/api-client-react";

// Single source of truth for the /api/badges/me query so Dashboard,
// AuthSync (invalidation), and AppShell (prefetch) stay in lockstep.
export const BADGES_ME_QUERY_KEY = ["/api/badges/me"] as const;

export async function fetchBadgesMe(): Promise<Badge[]> {
  const res = await fetch("/api/badges/me", { credentials: "include" });
  if (!res.ok) throw new Error(`badges/me ${res.status}`);
  return res.json();
}
