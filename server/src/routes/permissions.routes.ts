import { Router } from "express";
import { z } from "zod";
import { zodMessage } from "../lib/validation";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/requireAuth";
import {
  defaultPermissions,
  EDITABLE_ROLES,
  invalidatePermissionsCache,
  PERMISSION_MODULES,
  requirePermission,
} from "../lib/permissions";

export const permissionsRouter = Router();

permissionsRouter.use(requireAuth);
// Administración → Roles y permisos: solo quien tiene el permiso "roles" (por defecto,
// solo ADMIN) puede ver o editar la matriz — más estricto que las demás áreas de administración.
permissionsRouter.use(requirePermission("roles"));

permissionsRouter.get("/", async (_req, res) => {
  const defaults = defaultPermissions();
  const rows = await prisma.rolePermission.findMany();

  const matrix: Record<string, Record<string, boolean>> = {
    // ADMIN siempre tiene acceso total y nunca se lee de la base de datos.
    ADMIN: Object.fromEntries(PERMISSION_MODULES.map((k) => [k, true])),
  };
  for (const role of EDITABLE_ROLES) {
    matrix[role] = { ...defaults[role] };
  }
  for (const row of rows) {
    if (!matrix[row.role]) continue;
    matrix[row.role][row.key] = row.allowed;
  }

  res.json(matrix);
});

const updateSchema = z.object({
  role: z.enum(["GERENTE", "ADMINISTRATIVO", "VENDEDOR"]),
  key: z.string(),
  allowed: z.boolean(),
});

permissionsRouter.put("/", async (req, res) => {
  const bodyRole = (req.body as { role?: unknown })?.role;
  if (bodyRole === "ADMIN") {
    return res
      .status(400)
      .json({ error: "El rol Administrador no se puede editar, siempre tiene acceso total" });
  }
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: zodMessage(parsed.error) });
  }
  const { role, key, allowed } = parsed.data;
  if (!(PERMISSION_MODULES as readonly string[]).includes(key)) {
    return res.status(400).json({ error: "Llave de permiso inválida" });
  }

  await prisma.rolePermission.upsert({
    where: { role_key: { role, key } },
    create: { role, key, allowed },
    update: { allowed },
  });
  invalidatePermissionsCache();

  res.json({ role, key, allowed });
});
