import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { User, type Permission } from "../models/User.js";

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; role: "admin" | "user"; permissions: Permission[] };
    }
  }
}

export async function auth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace("Bearer ", "") || String(req.query.token || "");
  if (!token) return res.status(401).json({ message: "Login required" });
  try {
    const payload = jwt.verify(token, config.jwtSecret) as { id: string };
    const user = await User.findById(payload.id).lean();
    if (!user || !user.active) return res.status(401).json({ message: "User inactive" });
    req.user = { id: String(user._id), role: user.role as "admin" | "user", permissions: user.permissions as Permission[] };
    return next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
}

export function permit(permission?: Permission) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.user?.role === "admin") return next();
    if (!permission) return next();
    if (req.user?.permissions.includes(permission)) return next();
    return res.status(403).json({ message: "Permission denied" });
  };
}
