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
// bump this when we test a newer schema.
const JOBBER_GRAPHQL = "https://api.getjobber.com/api/graphql";
const JOBBER_API_VERSION = "2024-04-15";
const PAGE_SIZE = 50;

interface JobberAddress {
  street1?: string | null;
  street2?: string | null;
  city?: string | null;
  province?: string | null;
  postalCode?: string | null;
}

interface JobberPhone {
  number?: string | null;
}

interface JobberClient {
  id: string;
  name?: string | null;
  companyName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  emails?: Array<{ address?: string | null }> | null;
  phones?: JobberPhone[] | null;
  billingAddress?: JobberAddress | null;
}

interface JobberJob {
  id: string;
  jobNumber: number;
  title?: string | null;
  jobStatus?: string | null;
  total?: number | null;
  client?: JobberClient | null;
  property?: { address?: JobberAddress | null } | null;
  startAt?: string | null;
  endAt?: string | null;
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

const JOBS_QUERY = /* GraphQL */ `
  query SalesHubJobs($first: Int!, $after: String) {
    jobs(first: $first, after: $after) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        id
        jobNumber
        title
        jobStatus
        total
        startAt
        endAt
        property {
          address {
            street1
            street2
            city
            province
            postalCode
          }
        }
        client {
          id
          companyName
          firstName
          lastName
          phones {
            number
          }
          billingAddress {
            street1
            street2
            city
            province
            postalCode
          }
        }
      }
    }
  }
`;

interface JobsPage {
  jobs: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    nodes: JobberJob[];
  };
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

export interface SyncResult {
  ok: boolean;
  jobsSeen: number;
  pinsCreated: number;
  pinsUpdated: number;
  geocodeMisses: number;
  error: string | null;
  elapsedMs: number;
}

/**
 * Pull all jobs from Jobber, geocode their addresses, and upsert into the
 * pins table tagged source="jobber". Idempotent — re-running just updates
 * existing pins by their externalId.
 */
export async function syncJobberJobs(): Promise<SyncResult> {
  const t0 = Date.now();
  const [cred] = await db
    .select()
    .from(integrationCredentialsTable)
    .where(eq(integrationCredentialsTable.provider, "jobber"))
    .limit(1);

  if (!cred?.accessToken) {
    return {
      ok: false,
      jobsSeen: 0,
      pinsCreated: 0,
      pinsUpdated: 0,
      geocodeMisses: 0,
      error: "Jobber not configured. Paste an access token in Admin → Integrations.",
      elapsedMs: Date.now() - t0,
    };
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
    const [any] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .limit(1);
    attributedRepId = any?.id ?? null;
  }
  if (!attributedRepId) {
    return {
      ok: false,
      jobsSeen: 0,
      pinsCreated: 0,
      pinsUpdated: 0,
      geocodeMisses: 0,
      error: "No users yet — sign in once before running the Jobber sync.",
      elapsedMs: Date.now() - t0,
    };
  }

  let after: string | null = null;
  let jobsSeen = 0;
  let pinsCreated = 0;
  let pinsUpdated = 0;
  let geocodeMisses = 0;

  try {
    while (true) {
      const data: JobsPage = await jobberQuery<JobsPage>(cred.accessToken, JOBS_QUERY, {
        first: PAGE_SIZE,
        after,
      });
      const nodes = data.jobs?.nodes ?? [];
      jobsSeen += nodes.length;

      for (const job of nodes) {
        const addr =
          addressToString(job.property?.address) ??
          addressToString(job.client?.billingAddress);
        if (!addr) continue;

        const geo = await geocodeAddress(addr);
        if (!geo) {
          geocodeMisses += 1;
          continue;
        }

        const externalId = `jobber:job:${job.id}`;
        const status = mapJobStatusToPinStatus(job.jobStatus);
        const phone = job.client?.phones?.[0]?.number ?? null;
        const residentName = clientName(job.client);

        const [existing] = await db
          .select({ id: pinsTable.id, residentSource: pinsTable.residentSource })
          .from(pinsTable)
          .where(eq(pinsTable.externalId, externalId))
          .limit(1);

        if (existing) {
          // Refresh values; don't trample a rep's manually-entered resident
          // info even when Jobber would overwrite it.
          await db
            .update(pinsTable)
            .set({
              latitude: geo.latitude,
              longitude: geo.longitude,
              address: addr,
              status,
              jobStatus: job.jobStatus ?? null,
              jobValue: typeof job.total === "number" ? job.total : null,
              notes: job.title ?? null,
              ...(existing.residentSource === "rep"
                ? {}
                : {
                    residentName: residentName ?? null,
                    residentPhone: phone ?? null,
                    residentSource: residentName || phone ? "jobber" : null,
                  }),
            })
            .where(eq(pinsTable.id, existing.id));
          pinsUpdated += 1;
        } else {
          await db.insert(pinsTable).values({
            repId: attributedRepId,
            latitude: geo.latitude,
            longitude: geo.longitude,
            address: addr,
            status,
            notes: job.title ?? null,
            source: "jobber",
            externalId,
            jobStatus: job.jobStatus ?? null,
            jobValue: typeof job.total === "number" ? job.total : null,
            residentName: residentName ?? null,
            residentPhone: phone ?? null,
            residentSource: residentName || phone ? "jobber" : null,
          });
          pinsCreated += 1;
        }
      }

      const pageInfo = data.jobs?.pageInfo;
      if (!pageInfo?.hasNextPage || !pageInfo.endCursor) break;
      after = pageInfo.endCursor;
    }

    await db
      .update(integrationCredentialsTable)
      .set({
        lastSyncAt: new Date(),
        lastSyncStatus: "ok",
        lastSyncError: null,
        lastSyncJobsCount: jobsSeen,
        updatedAt: new Date(),
      })
      .where(eq(integrationCredentialsTable.provider, "jobber"));

    logger.info(
      { jobsSeen, pinsCreated, pinsUpdated, geocodeMisses },
      "Jobber sync complete",
    );
    return {
      ok: true,
      jobsSeen,
      pinsCreated,
      pinsUpdated,
      geocodeMisses,
      error: null,
      elapsedMs: Date.now() - t0,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err }, "Jobber sync failed");
    await db
      .update(integrationCredentialsTable)
      .set({
        lastSyncAt: new Date(),
        lastSyncStatus: "failed",
        lastSyncError: message,
        updatedAt: new Date(),
      })
      .where(eq(integrationCredentialsTable.provider, "jobber"));
    return {
      ok: false,
      jobsSeen,
      pinsCreated,
      pinsUpdated,
      geocodeMisses,
      error: message,
      elapsedMs: Date.now() - t0,
    };
  }
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
