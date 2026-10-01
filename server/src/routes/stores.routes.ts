import { Router } from "express";
import { z } from "zod";
import { zodMessage } from "../lib/validation";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/requireAuth";
import { requirePermission } from "../lib/permissions";

export const storesRouter = Router();

storesRouter.use(requireAuth);

storesRouter.get("/", async (req, res) => {
  // Admin ve todas las tiendas; manager/empleado solo la suya.
  const where = req.auth!.role === "ADMIN" ? {} : { id: req.auth!.storeId ?? "" };
  const stores = await prisma.store.findMany({ where, orderBy: { name: "asc" } });
  res.json(stores);
});

const storeSchema = z.object({
  name: z.string().min(1),
  address: z.string().optional(),
  phone: z.string().optional(),
  /// Logo propio de la sede (data URL base64), como en el mockup.
  logo: z.string().optional(),
  themeColor: z.string().optional(),
  adminId: z.string().optional(),
  vendedorId: z.string().optional(),
});

// Administración → Sedes: alta de una tienda.
storesRouter.post("/", requirePermission("sedes"), async (req, res) => {
  const parsed = storeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: zodMessage(parsed.error) });
  }
  const store = await prisma.store.create({ data: parsed.data });
  res.status(201).json(store);
});

const updateStoreSchema = storeSchema.partial().extend({ active: z.boolean().optional() });

// Administración → Sedes: edición parcial, incluye Activar/Desactivar (nunca hard delete).
storesRouter.put("/:id", requirePermission("sedes"), async (req, res) => {
  const parsed = updateStoreSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: zodMessage(parsed.error) });
  }
  const store = await prisma.store.update({ where: { id: req.params.id }, data: parsed.data });
  res.json(store);
});
