import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { zodMessage } from "../lib/validation";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/requireAuth";

export const usersRouter = Router();

usersRouter.use(requireAuth);

// Gestión de empleados: solo ADMIN da de alta/edita/desactiva usuarios.
usersRouter.get("/", requireRole("ADMIN"), async (_req, res) => {
  const users = await prisma.user.findMany({
    include: { store: { select: { id: true, name: true } } },
    orderBy: { name: "asc" },
  });
  res.json(
    users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      storeId: u.storeId,
      storeName: u.store?.name ?? null,
      active: u.active,
      createdAt: u.createdAt,
    })),
  );
});

const roleEnum = z.enum(["ADMIN", "MANAGER", "EMPLOYEE"]);

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  role: roleEnum,
  storeId: z.string().min(1).optional(),
});

usersRouter.post("/", requireRole("ADMIN"), async (req, res) => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: zodMessage(parsed.error) });
  }
  if (parsed.data.role !== "ADMIN" && !parsed.data.storeId) {
    return res.status(400).json({ error: "Los roles Gerente/Vendedor requieren una tienda asignada" });
  }

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) {
    return res.status(400).json({ error: "Ya existe un usuario con ese email" });
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash,
      role: parsed.data.role,
      storeId: parsed.data.role === "ADMIN" ? undefined : parsed.data.storeId,
    },
  });
  res.status(201).json({ id: user.id, name: user.name, email: user.email, role: user.role, storeId: user.storeId });
});

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  role: roleEnum.optional(),
  storeId: z.string().min(1).optional(),
  active: z.boolean().optional(),
  password: z.string().min(6).optional(),
});

usersRouter.put("/:id", requireRole("ADMIN"), async (req, res) => {
  const parsed = updateUserSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: zodMessage(parsed.error) });
  }
  if (req.params.id === req.auth!.userId && parsed.data.active === false) {
    return res.status(400).json({ error: "No puedes desactivar tu propio usuario" });
  }
  const { password, ...rest } = parsed.data;
  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: {
      ...rest,
      passwordHash: password ? await bcrypt.hash(password, 10) : undefined,
    },
  });
  res.json({ id: user.id, name: user.name, email: user.email, role: user.role, storeId: user.storeId, active: user.active });
});
