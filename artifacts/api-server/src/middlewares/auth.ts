import type { Request, Response, NextFunction, RequestHandler } from "express";
import { getAuth } from "@clerk/express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

declare global {
  namespace Express {
    interface Request {
      currentUser?: typeof usersTable.$inferSelect;
    }
  }
}

export const requireAuth: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.clerkId, userId))
      .limit(1);
    if (!user) {
      res.status(401).json({ error: "User not registered" });
      return;
    }
    req.currentUser = user;
    next();
  } catch (err) {
    next(err);
  }
};

export const requireAdmin: RequestHandler = (req, res, next) => {
  if (!req.currentUser || req.currentUser.role !== "admin") {
    res.status(403).json({ error: "Admin only" });
    return;
  }
  next();
};
