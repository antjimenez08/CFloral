import { Router } from "express";
import { z } from "zod";
import { zodMessage } from "../lib/validation";
import { prisma } from "../lib/prisma";
import { requireAuth, resolveStoreId } from "../middleware/requireAuth";
import { requirePermission } from "../lib/permissions";

export const suppliesRouter = Router();

suppliesRouter.use(requireAuth);

suppliesRouter.get("/", async (req, res) => {
  const storeId = resolveStoreId(req);
  if (!storeId) return res.status(400).json({ error: "Falta seleccionar una tienda" });

  const supplies = await prisma.supply.findMany({
    where: { storeId, active: true },
    include: { supplier: { select: { id: true, name: true } } },
    orderBy: { name: "asc" },
  });
  res.json(supplies);
});

const supplySchema = z.object({
  storeId: z.string().min(1),
  name: z.string().min(1),
  unit: z.string().min(1),
  costPerUnit: z.number().nonnegative(),
  stock: z.number().nonnegative().default(0),
  supplierId: z.string().optional(),
});

suppliesRouter.post("/", requirePermission("insumos"), async (req, res) => {
  const parsed = supplySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: zodMessage(parsed.error) });
  }
  if (req.auth!.role !== "ADMIN" && req.auth!.storeId !== parsed.data.storeId) {
    return res.status(403).json({ error: "No puedes crear insumos para otra tienda" });
  }
  const supply = await prisma.supply.create({
    data: parsed.data,
    include: { supplier: { select: { id: true, name: true } } },
  });
  res.status(201).json(supply);
});

const supplyUpdateSchema = supplySchema.partial().extend({
  active: z.boolean().optional(),
});

suppliesRouter.put("/:id", requirePermission("insumos"), async (req, res) => {
  const parsed = supplyUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: zodMessage(parsed.error) });
  }
  const supply = await prisma.supply.update({
    where: { id: req.params.id },
    data: parsed.data,
    include: { supplier: { select: { id: true, name: true } } },
  });
  res.json(supply);
});
