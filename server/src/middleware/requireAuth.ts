import { NextFunction, Request, Response } from "express";
import { AuthTokenPayload, verifyToken } from "../lib/auth";

declare global {
  namespace Express {
    interface Request {
      auth?: AuthTokenPayload;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "No autenticado" });
  }

  try {
    req.auth = verifyToken(token);
    next();
  } catch {
    return res.status(401).json({ error: "Token inválido o expirado" });
  }
}

export function requireRole(...roles: Array<"ADMIN" | "MANAGER" | "EMPLOYEE">) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth || !roles.includes(req.auth.role)) {
      return res.status(403).json({ error: "No tienes permiso para esta acción" });
    }
    next();
  };
}

/** Resuelve el storeId efectivo: admins pueden pasar ?storeId=, el resto queda fijo a su tienda. */
export function resolveStoreId(req: Request): string | undefined {
  if (req.auth?.role === "ADMIN") {
    const q = (req.query.storeId as string | undefined) || (req.body?.storeId as string | undefined);
    return q || undefined;
  }
  return req.auth?.storeId || undefined;
}
