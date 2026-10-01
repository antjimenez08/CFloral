import { NextFunction, Request, Response } from "express";
import { prisma } from "./prisma";
import { AppRole } from "./auth";

/// Las 16 llaves de permiso editables en Administración → Roles y permisos,
/// igual que PERMISSION_MODULES en el mockup. ADMIN siempre tiene acceso total
/// y no pasa por esta matriz.
export const PERMISSION_MODULES = [
  "pedidos",
  "taller",
  "finanzas",
  "clientes",
  "clientesSensible",
  "inventario",
  "inventarioCosto",
  "insumos",
  "proveedores",
  "empleados",
  "sedes",
  "horarios",
  "listas",
  "empresa",
  "roles",
  "recomendaciones",
] as const;

export type PermissionKey = (typeof PERMISSION_MODULES)[number];

export const EDITABLE_ROLES: AppRole[] = ["GERENTE", "ADMINISTRATIVO", "VENDEDOR"];

export function defaultPermissions(): Record<AppRole, Record<PermissionKey, boolean>> {
  const base = (truthy: PermissionKey[]): Record<PermissionKey, boolean> =>
    Object.fromEntries(PERMISSION_MODULES.map((k) => [k, truthy.includes(k)])) as Record<
      PermissionKey,
      boolean
    >;
  return {
    ADMIN: base([...PERMISSION_MODULES]),
    GERENTE: base([
      "pedidos",
      "taller",
      "finanzas",
      "clientes",
      "clientesSensible",
      "inventario",
      "inventarioCosto",
      "insumos",
      "proveedores",
      "recomendaciones",
    ]),
    ADMINISTRATIVO: base([
      "pedidos",
      "taller",
      "finanzas",
      "clientes",
      "clientesSensible",
      "inventario",
      "inventarioCosto",
      "insumos",
    ]),
    VENDEDOR: base(["pedidos", "taller", "clientes", "inventario"]),
  };
}

let cache: { at: number; matrix: Record<string, Record<string, boolean>> } | null = null;
const CACHE_MS = 5000;

async function loadMatrix(): Promise<Record<string, Record<string, boolean>>> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.matrix;
  const rows = await prisma.rolePermission.findMany();
  const matrix: Record<string, Record<string, boolean>> = {};
  for (const role of EDITABLE_ROLES) matrix[role] = {};
  for (const row of rows) {
    if (!matrix[row.role]) matrix[row.role] = {};
    matrix[row.role][row.key] = row.allowed;
  }
  cache = { at: Date.now(), matrix };
  return matrix;
}

export function invalidatePermissionsCache() {
  cache = null;
}

/** Igual que can(key) del mockup: ADMIN siempre true; los demás roles consultan la matriz. */
export async function can(role: AppRole, key: string): Promise<boolean> {
  if (role === "ADMIN") return true;
  const matrix = await loadMatrix();
  return !!matrix[role]?.[key];
}

export function requirePermission(key: PermissionKey) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth) return res.status(401).json({ error: "No autenticado" });
    const allowed = await can(req.auth.role, key);
    if (!allowed) return res.status(403).json({ error: "No tienes permiso para esta acción" });
    next();
  };
}
