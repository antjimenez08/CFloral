import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { zodMessage } from "../lib/validation";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/requireAuth";
import { requirePermission } from "../lib/permissions";

export const usersRouter = Router();

usersRouter.use(requireAuth);

// Gestión de empleados (Administración → Empleados).
usersRouter.get("/", requirePermission("empleados"), async (_req, res) => {
  const users = await prisma.user.findMany({
    include: { store: { select: { id: true, name: true } }, jornada: true },
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
      hasSystemAccess: u.hasSystemAccess,
      documentId: u.documentId,
      phone: u.phone,
      position: u.position,
      hireDate: u.hireDate,
      contractType: u.contractType,
      eps: u.eps,
      pensionFund: u.pensionFund,
      arl: u.arl,
      salary: u.salary,
      schedule: u.schedule,
      jornadaId: u.jornadaId,
      jornadaName: u.jornada?.name ?? null,
      createdAt: u.createdAt,
    }))
  );
});

const roleEnum = z.enum(["ADMIN", "GERENTE", "ADMINISTRATIVO", "VENDEDOR"]);

const userSchema = z.object({
  name: z.string().min(1),
  documentId: z.string().optional(),
  phone: z.string().optional(),
  position: z.string().optional(),
  hireDate: z.string().datetime().optional().or(z.literal("")),
  storeId: z.string().min(1).optional(),
  contractType: z.string().optional(),
  eps: z.string().optional(),
  pensionFund: z.string().optional(),
  arl: z.string().optional(),
  salary: z.number().nonnegative().optional(),
  jornadaId: z.string().optional(),
  schedule: z.record(z.any()).optional(),
  hasSystemAccess: z.boolean().optional().default(true),
  email: z.string().email().optional(),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres").optional(),
  role: roleEnum.optional(),
});

usersRouter.post("/", requirePermission("empleados"), async (req, res) => {
  const parsed = userSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: zodMessage(parsed.error) });
  }
  const data = parsed.data;
  if (data.hasSystemAccess) {
    if (!data.email || !data.password || !data.role) {
      return res.status(400).json({ error: "Email, contraseña y rol son obligatorios para dar acceso al sistema" });
    }
    if (data.role !== "ADMIN" && !data.storeId) {
      return res.status(400).json({ error: "Este rol requiere una tienda asignada" });
    }
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) return res.status(400).json({ error: "Ya existe un usuario con ese email" });
  }

  const passwordHash = data.hasSystemAccess && data.password ? await bcrypt.hash(data.password, 10) : await bcrypt.hash(Math.random().toString(36), 10);
  const { hireDate, password, ...rest } = data;
  const user = await prisma.user.create({
    data: {
      ...rest,
      email: data.hasSystemAccess ? data.email! : `sin-acceso-${Date.now()}@cfloral.local`,
      role: data.hasSystemAccess ? data.role! : "VENDEDOR",
      passwordHash,
      hireDate: hireDate ? new Date(hireDate) : undefined,
    },
  });
  res.status(201).json({ id: user.id, name: user.name, email: user.email, role: user.role, storeId: user.storeId });
});

const updateUserSchema = userSchema.partial().extend({ active: z.boolean().optional() });

usersRouter.put("/:id", requirePermission("empleados"), async (req, res) => {
  const parsed = updateUserSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: zodMessage(parsed.error) });
  }
  if (req.params.id === req.auth!.userId && parsed.data.active === false) {
    return res.status(400).json({ error: "No puedes desactivar tu propio usuario" });
  }
  const { password, hireDate, ...rest } = parsed.data;
  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: {
      ...rest,
      hireDate: hireDate ? new Date(hireDate) : undefined,
      passwordHash: password ? await bcrypt.hash(password, 10) : undefined,
    },
  });
  res.json({ id: user.id, name: user.name, email: user.email, role: user.role, storeId: user.storeId, active: user.active });
});

/// Para el popover de "mi información" en la topbar: cualquier usuario autenticado
/// puede editar su propio nombre/teléfono (la sede se asigna desde Sedes).
usersRouter.put("/me/profile", async (req, res) => {
  const schema = z.object({ name: z.string().min(1).optional(), phone: z.string().optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: zodMessage(parsed.error) });
  const user = await prisma.user.update({ where: { id: req.auth!.userId }, data: parsed.data });
  res.json({ id: user.id, name: user.name, phone: user.phone });
});
