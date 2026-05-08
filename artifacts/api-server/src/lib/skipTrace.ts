import { logger } from "./logger";

export interface SkipTraceHit {
  name: string | null;
  phone: string | null;
}

export interface SkipTraceQuery {
  address: string;
  latitude: number;
  longitude: number;
}

/**
 * Look up a resident name + phone for an address via a configured skip-trace
 * provider. Returns:
 *  - "unconfigured" when no provider env is set (UI shows a "configure" hint)
 *  - null when the provider responded but had no match
 *  - a hit object otherwise
 *
 * Providers are pluggable via SKIPTRACE_PROVIDER. Today we ship a "batchdata"
 * adapter; adding another provider is a matter of branching here.
 */
export async function skipTraceAddress(
  q: SkipTraceQuery,
): Promise<SkipTraceHit | null | "unconfigured"> {
  const provider = process.env.SKIPTRACE_PROVIDER?.trim().toLowerCase();
  const apiKey = process.env.SKIPTRACE_API_KEY?.trim();

  if (!provider || !apiKey) return "unconfigured";

  try {
    if (provider === "batchdata") {
      return await traceBatchData(q, apiKey);
    }
    if (provider === "mock") {
      return traceMock(q);
    }
    logger.warn({ provider }, "skip-trace: unknown provider, returning no match");
    return null;
  } catch (err) {
    logger.error({ err, provider }, "skip-trace: provider call failed");
    return null;
  }
}

// -- BatchData (https://www.batchdata.com/) ----------------------------------
// Reference: POST https://api.batchdata.com/api/v1/property/skip-trace with
// { requests: [{ propertyAddress: { ... } }] }
async function traceBatchData(q: SkipTraceQuery, apiKey: string): Promise<SkipTraceHit | null> {
  const res = await fetch("https://api.batchdata.com/api/v1/property/skip-trace", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      requests: [{ propertyAddress: { street: q.address } }],
    }),
  });

  if (!res.ok) {
    logger.warn({ status: res.status }, "skip-trace: batchdata non-200");
    return null;
  }

  const data = (await res.json()) as {
    results?: { persons?: Array<{ name?: { full?: string }; phoneNumbers?: Array<{ number?: string }> }> };
  };
  const person = data?.results?.persons?.[0];
  if (!person) return null;

  return {
    name: person.name?.full ?? null,
    phone: person.phoneNumbers?.[0]?.number ?? null,
  };
}

// -- Deterministic mock for local dev / e2e ---------------------------------
// Returns a fake hit so the UI flow is testable without a real provider.
function traceMock(q: SkipTraceQuery): SkipTraceHit {
  const seed = (q.address + q.latitude + q.longitude).length;
  const phone = `(555) ${String(100 + (seed % 900)).padStart(3, "0")}-${String(
    1000 + (seed * 7) % 9000,
  ).padStart(4, "0")}`;
  return { name: "Demo Resident", phone };
}
