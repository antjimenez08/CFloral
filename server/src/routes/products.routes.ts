import { Router } from "express";
import { z } from "zod";
import { zodMessage } from "../lib/validation";
import { prisma } from "../lib/prisma";
import { requireAuth, resolveStoreId } from "../middleware/requireAuth";

export const productsRouter = Router();

productsRouter.use(requireAuth);

const productCategory = z.enum([
  "FLOWERS",
  "GREENERY",
  "PLANT",
  "ARRANGEMENT",
  "CONTAINER",
  "BALLOON",
  "CARD",
  "GIFT_ADDON",
  "SUPPLY",
  "OTHER",
]);

productsRouter.get("/", async (req, res) => {
  const storeId = resolveStoreId(req);
  if (!storeId) return res.status(400).json({ error: "Falta seleccionar una tienda" });

  const category = req.query.category as string | undefined;
  const products = await prisma.product.findMany({
    where: { storeId, active: true, ...(category ? { category: category as never } : {}) },
    orderBy: { name: "asc" },
  });

  if (req.query.lowStock === "true") {
    return res.json(products.filter((p) => p.stock <= p.lowStockThreshold));
  }
  res.json(products);
});

const productSchema = z.object({
  storeId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  category: productCategory.optional(),
  sku: z.string().optional(),
  color: z.string().optional(),
  tags: z.string().optional(),
  unit: z.string().default("unidad"),
  unitPrice: z.number().nonnegative(),
  costPrice: z.number().nonnegative().optional(),
  stock: z.number().int().nonnegative().default(0),
  lowStockThreshold: z.number().int().nonnegative().default(5),
  reorderQuantity: z.number().int().nonnegative().optional(),
  shelfLifeDays: z.number().int().positive().optional(),
  receivedAt: z.string().datetime().optional().or(z.literal("")),
});

productsRouter.post("/", async (req, res) => {
  const parsed = productSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: zodMessage(parsed.error) });
  }
  if (req.auth!.role !== "ADMIN" && req.auth!.storeId !== parsed.data.storeId) {
    return res.status(403).json({ error: "No puedes crear productos para otra tienda" });
  }
  const { receivedAt, ...rest } = parsed.data;
  const product = await prisma.product.create({
    data: { ...rest, receivedAt: receivedAt ? new Date(receivedAt) : undefined },
  });
  res.status(201).json(product);
});

productsRouter.put("/:id", async (req, res) => {
  const parsed = productSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: zodMessage(parsed.error) });
  }
  const { receivedAt, ...rest } = parsed.data;
  const product = await prisma.product.update({
    where: { id: req.params.id },
    data: { ...rest, receivedAt: receivedAt ? new Date(receivedAt) : undefined },
  });
  res.json(product);
});
