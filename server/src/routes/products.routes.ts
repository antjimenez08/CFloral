import { Router } from "express";
import { z } from "zod";
import { zodMessage } from "../lib/validation";
import { prisma } from "../lib/prisma";
import { requireAuth, resolveStoreId } from "../middleware/requireAuth";

export const productsRouter = Router();

productsRouter.use(requireAuth);

productsRouter.get("/", async (req, res) => {
  const storeId = resolveStoreId(req);
  if (!storeId) return res.status(400).json({ error: "Falta seleccionar una tienda" });

  const products = await prisma.product.findMany({
    where: { storeId, active: true },
    orderBy: { name: "asc" },
  });
  res.json(products);
});

const productSchema = z.object({
  storeId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  unit: z.string().default("unidad"),
  unitPrice: z.number().nonnegative(),
  stock: z.number().int().nonnegative().default(0),
  lowStockThreshold: z.number().int().nonnegative().default(5),
});

productsRouter.post("/", async (req, res) => {
  const parsed = productSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: zodMessage(parsed.error) });
  }
  if (req.auth!.role !== "ADMIN" && req.auth!.storeId !== parsed.data.storeId) {
    return res.status(403).json({ error: "No puedes crear productos para otra tienda" });
  }
  const product = await prisma.product.create({ data: parsed.data });
  res.status(201).json(product);
});

productsRouter.put("/:id", async (req, res) => {
  const parsed = productSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: zodMessage(parsed.error) });
  }
  const product = await prisma.product.update({
    where: { id: req.params.id },
    data: parsed.data,
  });
  res.json(product);
});
