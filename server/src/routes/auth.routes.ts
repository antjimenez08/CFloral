import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { signToken } from "../lib/auth";
import { prisma } from "../lib/prisma";

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
  if (!user) {
    return res.status(401).json({ error: "Credenciales inválidas" });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: "Credenciales inválidas" });
  }

  const token = signToken({ userId: user.id, role: user.role, storeId: user.storeId });
  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      storeId: user.storeId,
      storeName: user.store?.name ?? null,
    },
  });
});
