/**
 * createDemoUser.ts
 *
 * One-shot script that creates (or resets) a persistent demo rep in the app
 * database and seeds it with a full set of mock activity. With username auth
 * there are no credentials to provision — the demo rep is just a name anyone
 * can type on the login screen.
 *
 * Usage:
 *   pnpm --filter @workspace/api-server run create-demo-user
 *
 * Override the display name with an env var:
 *   DEMO_NAME="Demo Rep" pnpm ...
 */

import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { seedDataForNewRep } from "../lib/seed.js";

const NAME = process.env.DEMO_NAME ?? "Demo Rep";

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

async function main() {
  const slug = slugify(NAME);
  const clerkId = `local:${slug}`;
  const email = `${slug}@rep.local`;

  const [existing] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.clerkId, clerkId))
    .limit(1);

  let userId: number;

  if (existing) {
    userId = existing.id;
    await db
      .update(usersTable)
      .set({ name: NAME, email })
      .where(eq(usersTable.id, userId));
    console.log(`DB user already exists: id=${userId}`);
  } else {
    const [inserted] = await db
      .insert(usersTable)
      .values({
        clerkId,
        name: NAME,
        email,
        avatarUrl: "https://i.pravatar.cc/150?img=60",
        role: "rep",
      })
      .returning();
    userId = inserted!.id;
    console.log(`Inserted DB user: id=${userId}`);
  }

  await seedDataForNewRep({
    userId,
    userName: NAME,
    userAvatarUrl: "https://i.pravatar.cc/150?img=60",
  });

  console.log(
    [
      "",
      "✅ Demo rep ready. To sign in, open the app and type this name:",
      `   Name: ${NAME}`,
      "",
      "If a team password is set (Admin → Access), enter that too.",
      "The account is seeded with deals, badges, and leaderboard activity.",
      "Re-running preserves existing activity (delete the user's",
      "deals/pins/posts from the DB to trigger a full re-seed).",
    ].join("\n"),
  );
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
