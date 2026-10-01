import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { signToken } from "../lib/auth";
import { prisma } from "../lib/prisma";
import { defaultPermissions, PERMISSION_MODULES } from "../lib/permissions";

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Email y contraseña son requeridos" });
  }

  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email }, include: { store: true } });
  if (!user || !user.active || !user.hasSystemAccess) {
    return res.status(401).json({ error: "Credenciales inválidas" });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: "Credenciales inválidas" });
  }

  const token = signToken({ userId: user.id, role: user.role, storeId: user.storeId });
  const defaults = defaultPermissions();
  const rows = await prisma.rolePermission.findMany();
  const permissions: Record<string, boolean> = { ...defaults[user.role] };
  for (const row of rows) {
    if (row.role === user.role) permissions[row.key] = row.allowed;
  }
  if (user.role === "ADMIN") {
    for (const key of PERMISSION_MODULES) permissions[key] = true;
  }

  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      storeId: user.storeId,
      storeName: user.store?.name ?? null,
      phone: user.phone,
      position: user.position,
    },
    permissions,
  });
});
