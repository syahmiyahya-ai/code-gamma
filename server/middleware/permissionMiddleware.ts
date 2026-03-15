import { Request, Response, NextFunction } from "express";
import { db } from "../db/db";
import { logger } from "../utils/logger";

export type UserRole = "Staff" | "Supervisor" | "RosterAdmin" | "SystemAdmin" | "Admin";

const ROLE_HIERARCHY: Record<UserRole, number> = {
  "Staff": 1,
  "Supervisor": 2,
  "RosterAdmin": 3,
  "Admin": 4, // Mapping legacy 'Admin' to high level
  "SystemAdmin": 5
};

/**
 * Middleware to enforce role-based access control.
 * Assumes user ID is provided in 'x-user-id' header for this implementation.
 */
export const requireRole = (minRole: UserRole) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
      logger.security("UNAUTHENTICATED_ACCESS_ATTEMPT", "ANONYMOUS", { url: req.originalUrl });
      return res.status(401).json({ error: "Authentication required" });
    }

    try {
      const user = db.prepare("SELECT role FROM users WHERE id = ?").get(userId) as { role: string } | undefined;

      if (!user) {
        logger.security("INVALID_USER_ACCESS_ATTEMPT", userId, { url: req.originalUrl });
        return res.status(403).json({ error: "User not found" });
      }

      const userRole = user.role as UserRole;
      const userLevel = ROLE_HIERARCHY[userRole] || 0;
      const requiredLevel = ROLE_HIERARCHY[minRole] || 0;

      if (userLevel < requiredLevel) {
        logger.security("PERMISSION_DENIED", userId, { 
          url: req.originalUrl, 
          userRole, 
          requiredRole: minRole 
        });
        return res.status(403).json({ error: "Insufficient permissions" });
      }

      // Attach user info to request for downstream use
      (req as any).user = { id: userId, role: userRole };
      next();
    } catch (error) {
      logger.error("PERMISSION_CHECK_ERROR", userId, { error: (error as Error).message });
      res.status(500).json({ error: "Internal server error during permission check" });
    }
  };
};
