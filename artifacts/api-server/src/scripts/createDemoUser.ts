/**
 * createDemoUser.ts
 *
 * One-shot script that creates (or resets) a persistent demo account in both
 * Clerk and the app database, then seeds it with a full set of mock activity.
 *
 * Usage:
 *   pnpm --filter @workspace/api-server run create-demo-user
 *
 * Override credentials with env vars:
 *   DEMO_EMAIL=test@example.com DEMO_PASSWORD=MyPassword1! pnpm ...
 *
 * Requires CLERK_SECRET_KEY to be set (already present in the Replit env).
 */

import { createClerkClient } from "@clerk/backend";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { seedDataForNewRep } from "../lib/seed.js";

const EMAIL = process.env.DEMO_EMAIL ?? "demo@joshuatreeinc.com";
const PASSWORD = process.env.DEMO_PASSWORD ?? "JoshuaTree2025!";

async function main() {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    console.error(
      "\nCLERK_SECRET_KEY is not set.\n" +
        "Add it as an environment secret in the Replit Secrets panel\n" +
        "(the same key used by the deployed API server).\n",
    );
    process.exit(1);
  }

  const clerk = createClerkClient({ secretKey });

  let clerkId: string;

  const existing = await clerk.users.getUserList({ emailAddress: [EMAIL] });
  if (existing.data.length > 0) {
    clerkId = existing.data[0].id;
    console.log(`Clerk user already exists: ${clerkId}`);
  } else {
    const created = await clerk.users.createUser({
      emailAddress: [EMAIL],
      password: PASSWORD,
      firstName: "Demo",
      lastName: "Rep",
    });
    clerkId = created.id;
    console.log(`Created Clerk user: ${clerkId}`);
  }

  const [existingDb] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.clerkId, clerkId))
    .limit(1);

  let userId: number;

  if (existingDb) {
    userId = existingDb.id;
    await db
      .update(usersTable)
      .set({ name: "Demo Rep", email: EMAIL })
      .where(eq(usersTable.id, userId));
    console.log(`DB user already exists: id=${userId}`);
  } else {
    const [inserted] = await db
      .insert(usersTable)
      .values({
        clerkId,
        name: "Demo Rep",
        email: EMAIL,
        avatarUrl: "https://i.pravatar.cc/150?img=60",
        role: "rep",
      })
      .returning();
    userId = inserted!.id;
    console.log(`Inserted DB user: id=${userId}`);
  }

  await seedDataForNewRep({
    userId,
    userName: "Demo Rep",
    userAvatarUrl: "https://i.pravatar.cc/150?img=60",
  });

  console.log(
    [
      "",
      "✅ Demo account ready — share these credentials:",
      `   Email:    ${EMAIL}`,
      `   Password: ${PASSWORD}`,
      "",
      "The account is fully seeded with deals, badges, and leaderboard activity.",
      "Run this script again at any time to reset if the data gets modified.",
    ].join("\n"),
  );
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
