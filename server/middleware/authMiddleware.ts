/**
 * authMiddleware.ts
 * Async session resolution middleware backed by SQLite via marketRepository.
 * Replaces the synchronous in-memory getSessionUser() helper.
 */

import { Request, Response, NextFunction } from "express";
import { marketRepository } from "../../src/services/storage/SqliteMarketRepository.ts";

// Extend Express Request to carry resolved userId
declare global {
  namespace Express {
    interface Request {
      userId?: string | null;
    }
  }
}

export function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) return authHeader.substring(7);
  const headerToken = req.headers["x-auth-token"];
  return typeof headerToken === "string" ? headerToken : null;
}

/**
 * Middleware: resolves session token → userId via DB.
 * Sets req.userId (null if unauthenticated / expired).
 * Always calls next() — individual routes decide whether authentication is required.
 */
export async function resolveSessionUser(req: Request, _res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) {
    req.userId = null;
    return next();
  }
  try {
    req.userId = await marketRepository.getSessionUserId(token);
  } catch {
    req.userId = null;
  }
  next();
}

/**
 * Guard middleware: returns 401 if req.userId is not set.
 * Use after resolveSessionUser on routes that require authentication.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.userId) {
    return res.status(401).json({ error: "Not authenticated", authenticated: false });
  }
  next();
}
