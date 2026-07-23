import {
  db,
  pinsTable,
  integrationCredentialsTable,
  usersTable,
} from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import { logger } from "./logger";
import { geocodeAddress } from "./geocode";

// Jobber GraphQL endpoint + version. Versions are pinned per Jobber docs;
// bump JOBBER_API_VERSION (env-overridable) when we test a newer schema.
const JOBBER_GRAPHQL = "https://api.getjobber.com/api/graphql";
const JOBBER_API_VERSION = process.env.JOBBER_API_VERSION ?? "2024-04-15";
const PAGE_SIZE = 50;

/** Which Jobber record a pin came from. */
export type JobberKind = "job" | "quote" | "request";

interface JobberAddress {
  street1?: string | null;
  street2?: string | null;
  city?: string | null;
  province?: string | null;
  postalCode?: string | null;
}

interface JobberPhone {
  number?: string | null;
  description?: string | null;
  primary?: boolean | null;
}

interface JobberEmail {
  address?: string | null;
  description?: string | null;
  primary?: boolean | null;
}

interface JobberClient {
  id: string;
  name?: string | null;
  companyName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  emails?: JobberEmail[] | null;
  phones?: JobberPhone[] | null;
  billingAddress?: JobberAddress | null;
}

interface JobberRecord {
  id: string;
  title?: string | null;
  client?: JobberClient | null;
  property?: { address?: JobberAddress | null } | null;
  jobberWebUri?: string | null;
  // job
  jobNumber?: number | null;
  jobStatus?: string | null;
  total?: number | null;
  // quote
  quoteNumber?: number | null;
  quoteStatus?: string | null;
  cost?: number | null;
  // request
  requestStatus?: string | null;
}

/** Normalized phone entry we persist as JSON on the pin. */
export interface PinPhone {
  number: string;
  description: string | null;
  primary: boolean;
}

function addressToString(a?: JobberAddress | null): string | null {
  if (!a) return null;
  const parts = [a.street1, a.street2, a.city, a.province, a.postalCode]
    .filter((p): p is string => typeof p === "string" && p.trim().length > 0);
  return parts.length > 0 ? parts.join(", ") : null;
}

function clientName(c?: JobberClient | null): string | null {
  if (!c) return null;
  if (c.companyName) return c.companyName;
  const parts = [c.firstName, c.lastName].filter((p): p is string => !!p);
  if (parts.length > 0) return parts.join(" ");
  return c.name ?? null;
}

/**
 * Every phone Jobber has for the client, de-duplicated by digits and sorted
 * so the primary number leads. Reps calling from the map want the mobile
 * first, not whichever row the API happened to return first.
 */
function normalizePhones(c?: JobberClient | null): PinPhone[] {
  const raw = c?.phones ?? [];
  const seen = new Set<string>();
  const out: PinPhone[] = [];
  for (const p of raw) {
    const number = p?.number?.trim();
    if (!number) continue;
    const digits = number.replace(/\D/g, "");
    if (digits.length < 7 || seen.has(digits)) continue;
    seen.add(digits);
    out.push({
      number,
      description: p.description?.trim() || null,
      primary: p.primary === true,
    });
  }
  const rank = (p: PinPhone) => {
    if (p.primary) return 0;
    const d = (p.description ?? "").toLowerCase();
    if (d.includes("mobile") || d.includes("cell")) return 1;
    if (d.includes("main")) return 2;
    return 3;
  };
  return out.sort((a, b) => rank(a) - rank(b));
}

function bestEmail(c?: JobberClient | null): string | null {
  const raw = c?.emails ?? [];
  const valid = raw
    .map((e) => ({ address: e?.address?.trim() ?? "", primary: e?.primary === true }))
    .filter((e) => e.address.includes("@"));
  if (valid.length === 0) return null;
  return (valid.find((e) => e.primary) ?? valid[0]!).address;
}

async function jobberQuery<T>(
  accessToken: string,
  query: string,
  variables: Record<string, unknown> = {},
): Promise<T> {
  const res = await fetch(JOBBER_GRAPHQL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      "X-JOBBER-GRAPHQL-VERSION": JOBBER_API_VERSION,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (res.status === 401 || res.status === 403) {
    throw new Error(
      "Jobber rejected the access token (401/403). Jobber access tokens expire — paste a fresh one in Admin → Integrations.",
    );
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Jobber API ${res.status}: ${text.slice(0, 200) || "no body"}`,
    );
  }
  const json = (await res.json()) as { data?: T; errors?: Array<{ message: string }> };
  if (json.errors && json.errors.length > 0) {
    throw new Error(
      `Jobber GraphQL error: ${json.errors.map((e) => e.message).join("; ")}`,
    );
  }
  if (!json.data) throw new Error("Jobber: empty data envelope");
  return json.data;
}

// Contact block shared by every entity query. `description` and `primary`
// exist on ClientPhoneNumber / ClientEmail in Jobber's schema.
const CLIENT_FIELDS = /* GraphQL */ `
  id
  companyName
  firstName
  lastName
  phones {
    number
    description
    primary
  }
  emails {
    address
    description
    primary
  }
  billingAddress {
    street1
    street2
    city
    province
    postalCode
  }
`;

const PROPERTY_FIELDS = /* GraphQL */ `
  property {
    address {
      street1
      street2
      city
      province
      postalCode
    }
  }
`;

// `jobberWebUri` gives reps a one-tap jump into the record in Jobber. It's
// not on every schema version, so it lives behind the `rich` flag and we
// retry without it if the server rejects the field.
const webUri = (rich: boolean) => (rich ? "jobberWebUri" : "");

function jobsQuery(rich: boolean): string {
  return /* GraphQL */ `
    query SalesHubJobs($first: Int!, $after: String) {
      jobs(first: $first, after: $after) {
        pageInfo { hasNextPage endCursor }
        nodes {
          id
          jobNumber
          title
          jobStatus
          total
          ${webUri(rich)}
          ${PROPERTY_FIELDS}
          client { ${CLIENT_FIELDS} }
        }
      }
    }
  `;
}

function quotesQuery(rich: boolean): string {
  return /* GraphQL */ `
    query SalesHubQuotes($first: Int!, $after: String) {
      quotes(first: $first, after: $after) {
        pageInfo { hasNextPage endCursor }
        nodes {
          id
          quoteNumber
          title
          quoteStatus
          cost
          ${webUri(rich)}
          ${PROPERTY_FIELDS}
          client { ${CLIENT_FIELDS} }
        }
      }
    }
  `;
}

function requestsQuery(rich: boolean): string {
  return /* GraphQL */ `
    query SalesHubRequests($first: Int!, $after: String) {
      requests(first: $first, after: $after) {
        pageInfo { hasNextPage endCursor }
        nodes {
          id
          title
          requestStatus
          ${webUri(rich)}
          ${PROPERTY_FIELDS}
          client { ${CLIENT_FIELDS} }
        }
      }
    }
  `;
}

interface Connection {
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
  nodes: JobberRecord[];
}

// Mark "completed" / "archived" / "invoiced" jobs as sold; anything that
// still smells active maps to "lead". The map page already styles these
// distinctly, and the Opportunities engine treats sold pins as proven blocks.
function mapJobStatusToPinStatus(jobStatus?: string | null): "lead" | "sold" {
  if (!jobStatus) return "lead";
  const s = jobStatus.toLowerCase();
  if (
    s.includes("complete") ||
    s.includes("archive") ||
    s.includes("invoice") ||
    s.includes("paid") ||
    s === "closed"
  ) {
    return "sold";
  }
  return "lead";
}

// An approved quote is effectively won work; anything else is still an open
// opportunity worth a re-knock.
function mapQuoteStatusToPinStatus(quoteStatus?: string | null): "quoted" | "sold" {
  const s = (quoteStatus ?? "").toLowerCase();
  if (s.includes("approved") || s.includes("converted") || s.includes("won")) {
    return "sold";
  }
  return "quoted";
}

export interface EntitySyncResult {
  kind: JobberKind;
  ok: boolean;
  seen: number;
  created: number;
  updated: number;
  skippedNoAddress: number;
  geocodeMisses: number;
  error: string | null;
}

export interface SyncResult {
  ok: boolean;
  jobsSeen: number;
  pinsCreated: number;
  pinsUpdated: number;
  geocodeMisses: number;
  error: string | null;
  elapsedMs: number;
  entities: EntitySyncResult[];
}

function emptyEntityResult(kind: JobberKind): EntitySyncResult {
  return {
    kind,
    ok: false,
    seen: 0,
    created: 0,
    updated: 0,
    skippedNoAddress: 0,
    geocodeMisses: 0,
    error: null,
  };
}

interface NormalizedRecord {
  externalId: string;
  kind: JobberKind;
  address: string;
  status: string;
  jobStatus: string | null;
  jobValue: number | null;
  notes: string | null;
  externalUrl: string | null;
  externalClientId: string | null;
  residentName: string | null;
  phones: PinPhone[];
  email: string | null;
}

function normalize(node: JobberRecord, kind: JobberKind): NormalizedRecord | null {
  const address =
    addressToString(node.property?.address) ??
    addressToString(node.client?.billingAddress);
  if (!address) return null;

  const phones = normalizePhones(node.client);
  const base = {
    externalId: `jobber:${kind}:${node.id}`,
    kind,
    address,
    externalUrl: node.jobberWebUri ?? null,
    externalClientId: node.client?.id ?? null,
    residentName: clientName(node.client),
    phones,
    email: bestEmail(node.client),
  };

  if (kind === "job") {
    return {
      ...base,
      status: mapJobStatusToPinStatus(node.jobStatus),
      jobStatus: node.jobStatus ?? null,
      jobValue: typeof node.total === "number" ? node.total : null,
      notes: node.title ?? (node.jobNumber ? `Job #${node.jobNumber}` : null),
    };
  }
  if (kind === "quote") {
    return {
      ...base,
      status: mapQuoteStatusToPinStatus(node.quoteStatus),
      jobStatus: node.quoteStatus ?? null,
      jobValue: typeof node.cost === "number" ? node.cost : null,
      notes:
        node.title ?? (node.quoteNumber ? `Quote #${node.quoteNumber}` : "Open quote"),
    };
  }
  return {
    ...base,
    status: "requested",
    jobStatus: node.requestStatus ?? null,
    jobValue: null,
    notes: node.title ?? "Work request",
  };
}

/**
 * Upsert one normalized record into `pins`. Rep-entered resident info always
 * wins — a rep who wrote down the homeowner's real cell shouldn't have it
 * overwritten by whatever stale number Jobber holds.
 */
async function upsertPin(
  rec: NormalizedRecord,
  attributedRepId: number,
  result: EntitySyncResult,
): Promise<void> {
  const geo = await geocodeAddress(rec.address);
  if (!geo) {
    result.geocodeMisses += 1;
    return;
  }

  const contact = {
    residentName: rec.residentName,
    residentPhone: rec.phones[0]?.number ?? null,
    residentPhones: rec.phones.length > 0 ? JSON.stringify(rec.phones) : null,
    residentEmail: rec.email,
    residentSource:
      rec.residentName || rec.phones.length > 0 || rec.email ? "jobber" : null,
  };

  const [existing] = await db
    .select({ id: pinsTable.id, residentSource: pinsTable.residentSource })
    .from(pinsTable)
    .where(eq(pinsTable.externalId, rec.externalId))
    .limit(1);

  if (existing) {
    await db
      .update(pinsTable)
      .set({
        latitude: geo.latitude,
        longitude: geo.longitude,
        address: rec.address,
        status: rec.status,
        jobStatus: rec.jobStatus,
        jobValue: rec.jobValue,
        notes: rec.notes,
        externalKind: rec.kind,
        externalClientId: rec.externalClientId,
        externalUrl: rec.externalUrl,
        ...(existing.residentSource === "rep" ? {} : contact),
      })
      .where(eq(pinsTable.id, existing.id));
    result.updated += 1;
  } else {
    await db.insert(pinsTable).values({
      repId: attributedRepId,
      latitude: geo.latitude,
      longitude: geo.longitude,
      address: rec.address,
      status: rec.status,
      notes: rec.notes,
      source: "jobber",
      externalId: rec.externalId,
      externalKind: rec.kind,
      externalClientId: rec.externalClientId,
      externalUrl: rec.externalUrl,
      jobStatus: rec.jobStatus,
      jobValue: rec.jobValue,
      ...contact,
    });
    result.created += 1;
  }
}

/** True when a GraphQL error looks like "you asked for a field I don't have". */
function isUnknownFieldError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("doesn't exist on type") ||
    m.includes("does not exist on type") ||
    m.includes("cannot query field") ||
    m.includes("undefinedfield")
  );
}

/**
 * Page through one Jobber connection and upsert every node. Each entity is
 * isolated: if `requests` isn't available on this account's plan or schema
 * version, jobs and quotes still sync and the failure is reported on its own.
 */
async function syncEntity(
  accessToken: string,
  kind: JobberKind,
  buildQuery: (rich: boolean) => string,
  connectionKey: "jobs" | "quotes" | "requests",
  attributedRepId: number,
): Promise<EntitySyncResult> {
  const result = emptyEntityResult(kind);
  let rich = true;
  let after: string | null = null;

  try {
    while (true) {
      let data: Record<string, Connection>;
      try {
        data = await jobberQuery<Record<string, Connection>>(
          accessToken,
          buildQuery(rich),
          { first: PAGE_SIZE, after },
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        // One retry without the optional fields before giving up on this
        // entity entirely.
        if (rich && isUnknownFieldError(message)) {
          logger.warn({ kind, message }, "Jobber: retrying without optional fields");
          rich = false;
          continue;
        }
        throw err;
      }

      const conn = data[connectionKey];
      const nodes = conn?.nodes ?? [];
      result.seen += nodes.length;

      for (const node of nodes) {
        const rec = normalize(node, kind);
        if (!rec) {
          result.skippedNoAddress += 1;
          continue;
        }
        await upsertPin(rec, attributedRepId, result);
      }

      const pageInfo = conn?.pageInfo;
      if (!pageInfo?.hasNextPage || !pageInfo.endCursor) break;
      after = pageInfo.endCursor;
    }
    result.ok = true;
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err);
    logger.error({ err, kind }, "Jobber entity sync failed");
  }
  return result;
}

/**
 * Pull jobs, quotes, and work requests from Jobber, geocode their addresses,
 * and upsert into the pins table tagged source="jobber". Idempotent —
 * re-running just updates existing pins by their externalId.
 */
export async function syncJobberJobs(): Promise<SyncResult> {
  const t0 = Date.now();
  const fail = (error: string): SyncResult => ({
    ok: false,
    jobsSeen: 0,
    pinsCreated: 0,
    pinsUpdated: 0,
    geocodeMisses: 0,
    error,
    elapsedMs: Date.now() - t0,
    entities: [],
  });

  const [cred] = await db
    .select()
    .from(integrationCredentialsTable)
    .where(eq(integrationCredentialsTable.provider, "jobber"))
    .limit(1);

  if (!cred?.accessToken) {
    return fail(
      "Jobber not configured. Paste an access token in Admin → Integrations.",
    );
  }

  // Ensure we have a placeholder user to attribute Jobber pins to.
  // Reuse an admin if available; otherwise pick any user. We need a valid
  // repId because pins.rep_id is NOT NULL.
  const [admin] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.role, "admin"))
    .limit(1);
  let attributedRepId = admin?.id ?? null;
  if (!attributedRepId) {
    const [anyUser] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .limit(1);
    attributedRepId = anyUser?.id ?? null;
  }
  if (!attributedRepId) {
    return fail("No users yet — sign in once before running the Jobber sync.");
  }

  const entities: EntitySyncResult[] = [];
  entities.push(
    await syncEntity(cred.accessToken, "job", jobsQuery, "jobs", attributedRepId),
  );
  entities.push(
    await syncEntity(cred.accessToken, "quote", quotesQuery, "quotes", attributedRepId),
  );
  entities.push(
    await syncEntity(
      cred.accessToken,
      "request",
      requestsQuery,
      "requests",
      attributedRepId,
    ),
  );

  const jobsSeen = entities.reduce((n, e) => n + e.seen, 0);
  const pinsCreated = entities.reduce((n, e) => n + e.created, 0);
  const pinsUpdated = entities.reduce((n, e) => n + e.updated, 0);
  const geocodeMisses = entities.reduce((n, e) => n + e.geocodeMisses, 0);
  const failures = entities.filter((e) => !e.ok);
  // Partial success still counts as a sync: reps get their jobs even when a
  // single connection is unavailable. Only a total wipeout is a hard failure.
  const ok = failures.length < entities.length;
  const error =
    failures.length === 0
      ? null
      : failures.map((f) => `${f.kind}s: ${f.error}`).join(" | ");

  await db
    .update(integrationCredentialsTable)
    .set({
      lastSyncAt: new Date(),
      lastSyncStatus: ok ? (failures.length > 0 ? "partial" : "ok") : "failed",
      lastSyncError: error,
      lastSyncJobsCount: jobsSeen,
      updatedAt: new Date(),
    })
    .where(eq(integrationCredentialsTable.provider, "jobber"));

  logger.info(
    { jobsSeen, pinsCreated, pinsUpdated, geocodeMisses, entities },
    "Jobber sync complete",
  );

  return {
    ok,
    jobsSeen,
    pinsCreated,
    pinsUpdated,
    geocodeMisses,
    error,
    elapsedMs: Date.now() - t0,
    entities,
  };
}

// Convenience used by the boot warmer — silently no-ops when not configured.
export async function syncJobberJobsIfConfigured(): Promise<void> {
  try {
    const [cred] = await db
      .select()
      .from(integrationCredentialsTable)
      .where(
        and(
          eq(integrationCredentialsTable.provider, "jobber"),
          sql`${integrationCredentialsTable.accessToken} IS NOT NULL`,
        ),
      )
      .limit(1);
    if (!cred) return;
    await syncJobberJobs();
  } catch {
    /* already logged */
  }
}
