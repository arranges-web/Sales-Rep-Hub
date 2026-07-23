import { db, appSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

/**
 * Instance-wide switches stored in `app_settings`. These need to survive a
 * restart — the boot seeder runs on every process start, so "we went live and
 * deleted the demo reps" has to be recorded somewhere durable or the seeder
 * cheerfully puts all 25 of them back.
 */
export const DEMO_DATA_ENABLED = "demo_data_enabled";

export async function getSetting(key: string): Promise<string | null> {
  const [row] = await db
    .select({ value: appSettingsTable.value })
    .from(appSettingsTable)
    .where(eq(appSettingsTable.key, key))
    .limit(1);
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await db
    .insert(appSettingsTable)
    .values({ key, value })
    .onConflictDoUpdate({
      target: appSettingsTable.key,
      set: { value, updatedAt: new Date() },
    });
}

/**
 * Demo data is on until someone explicitly turns it off from Admin → Go Live.
 * Defaulting to `true` keeps fresh installs looking populated.
 */
export async function isDemoDataEnabled(): Promise<boolean> {
  return (await getSetting(DEMO_DATA_ENABLED)) !== "false";
}

export async function setDemoDataEnabled(enabled: boolean): Promise<void> {
  await setSetting(DEMO_DATA_ENABLED, enabled ? "true" : "false");
}
