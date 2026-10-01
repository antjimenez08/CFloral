import { Router } from "express";
import { z } from "zod";
import { zodMessage } from "../lib/validation";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/requireAuth";
import { requirePermission } from "../lib/permissions";

export const suppliersRouter = Router();

suppliersRouter.use(requireAuth);

suppliersRouter.get("/", async (req, res) => {
  const suppliers = await prisma.supplier.findMany({ orderBy: { name: "asc" } });
  res.json(suppliers);
});

const supplierSchema = z.object({
  name: z.string().min(1),
  contactName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  taxId: z.string().optional(),
  categories: z.string().optional(),
  paymentTerms: z.string().optional(),
  leadTimeDays: z.number().int().optional(),
  rating: z.number().int().min(1).max(5).optional(),
  notes: z.string().optional(),
});

suppliersRouter.post("/", requirePermission("proveedores"), async (req, res) => {
  const parsed = supplierSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: zodMessage(parsed.error) });
  }
  const supplier = await prisma.supplier.create({ data: parsed.data });
  res.status(201).json(supplier);
});

const supplierUpdateSchema = supplierSchema.partial().extend({
  active: z.boolean().optional(),
});

suppliersRouter.put("/:id", requirePermission("proveedores"), async (req, res) => {
  const parsed = supplierUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: zodMessage(parsed.error) });
  }
  const supplier = await prisma.supplier.update({
    where: { id: req.params.id },
    data: parsed.data,
  });
  res.json(supplier);
});
