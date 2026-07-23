import type { Request, Response, NextFunction, RequestHandler } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { verifyToken } from "../lib/authToken";

declare global {
  namespace Express {
    interface Request {
      currentUser?: typeof usersTable.$inferSelect;
    }
  }
}

/** Pull the session token from the Authorization header (or x-jt-token). */
export function tokenFromRequest(req: Request): string | null {
  const header = req.headers.authorization;
  if (header && header.startsWith("Bearer ")) return header.slice(7).trim();
  const alt = req.headers["x-jt-token"];
  if (typeof alt === "string" && alt.length > 0) return alt;
  return null;
}

export const requireAuth: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const token = tokenFromRequest(req);
    if (!token) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const uid = await verifyToken(token);
    if (!uid) {
      res.status(401).json({ error: "Invalid or expired session" });
      return;
    }
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.clerkId, uid))
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
