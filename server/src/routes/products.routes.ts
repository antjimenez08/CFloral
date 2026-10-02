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

  const category = req.query.category as string | undefined;
  const products = await prisma.product.findMany({
    where: { storeId, active: true, ...(category ? { category } : {}) },
    include: { recipe: { include: { supply: true } } },
    orderBy: { name: "asc" },
  });

  const withLinks = await Promise.all(
    products.map(async (p) => {
      const linkedStoreIds = p.groupId
        ? (
            await prisma.product.findMany({
              where: { groupId: p.groupId, id: { not: p.id } },
              select: { storeId: true },
            })
          ).map((x) => x.storeId)
        : [];
      return { ...p, linkedStoreIds };
    })
  );

  if (req.query.lowStock === "true") {
    return res.json(withLinks.filter((p) => p.stock <= p.lowStockThreshold));
  }
  res.json(withLinks);
});

productsRouter.get("/:id", async (req, res) => {
  const product = await prisma.product.findUnique({
    where: { id: req.params.id },
    include: { recipe: { include: { supply: true } } },
  });
  if (!product) return res.status(404).json({ error: "Producto no encontrado" });
  res.json(product);
});

const recipeItemSchema = z.object({
  supplyId: z.string().min(1),
  quantity: z.number().positive(),
});

const productSchema = z.object({
  storeId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  category: z.string().optional(),
  sku: z.string().optional(),
  color: z.string().optional(),
  tags: z.string().optional(),
  unit: z.string().default("unidad"),
  unitPrice: z.number().nonnegative(),
  costPrice: z.number().nonnegative().optional(),
  laborCost: z.number().nonnegative().optional(),
  stock: z.number().int().nonnegative().default(0),
  lowStockThreshold: z.number().int().nonnegative().default(5),
  reorderQuantity: z.number().int().nonnegative().optional(),
  shelfLifeDays: z.number().int().positive().optional(),
  receivedAt: z.string().datetime().optional().or(z.literal("")),
  groupId: z.string().optional(),
  coverPhoto: z.string().nullable().optional(),
  photos: z.array(z.string()).optional(),
  recipe: z.array(recipeItemSchema).optional(),
});

productsRouter.post("/", async (req, res) => {
  const parsed = productSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: zodMessage(parsed.error) });
  }
  if (req.auth!.role !== "ADMIN" && req.auth!.storeId !== parsed.data.storeId) {
    return res.status(403).json({ error: "No puedes crear productos para otra tienda" });
  }
  const { receivedAt, recipe, photos, ...rest } = parsed.data;
  const product = await prisma.product.create({
    data: {
      ...rest,
      receivedAt: receivedAt ? new Date(receivedAt) : undefined,
      photos: photos ?? undefined,
      recipe: recipe?.length ? { create: recipe } : undefined,
    },
    include: { recipe: { include: { supply: true } } },
  });
  // Un producto nuevo sin groupId explícito empieza como su propio grupo de 1.
  if (!product.groupId) {
    await prisma.product.update({ where: { id: product.id }, data: { groupId: product.id } });
  }
  res.status(201).json(product);
});

/// Campos que describen el producto en sí (no la existencia de esta tienda puntual:
/// precio, costo, stock, receta, etc. quedan fuera y se mantienen independientes por tienda).
const SHARED_PRODUCT_FIELDS = ["name", "description", "category", "color", "tags", "unit", "coverPhoto", "photos"] as const;

productsRouter.put("/:id", async (req, res) => {
  const parsed = productSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: zodMessage(parsed.error) });
  }
  const { receivedAt, recipe, photos, ...rest } = parsed.data;
  if (recipe) {
    await prisma.productSupply.deleteMany({ where: { productId: req.params.id } });
  }
  const product = await prisma.product.update({
    where: { id: req.params.id },
    data: {
      ...rest,
      receivedAt: receivedAt ? new Date(receivedAt) : undefined,
      photos: photos ?? undefined,
      recipe: recipe?.length ? { create: recipe } : undefined,
    },
    include: { recipe: { include: { supply: true } } },
  });

  // Sincroniza los datos compartidos del producto (nombre, foto, categoría...) hacia las
  // demás tiendas donde está vinculado, para que editar cualquiera de las copias actualice
  // a todas — igual que el mockup, donde un producto multi-tienda es "el mismo producto".
  if (product.groupId) {
    const sharedUpdate: Record<string, unknown> = {};
    for (const key of SHARED_PRODUCT_FIELDS) {
      if (key in rest) sharedUpdate[key] = (rest as Record<string, unknown>)[key];
    }
    if (photos !== undefined) sharedUpdate.photos = photos;
    if (Object.keys(sharedUpdate).length > 0) {
      await prisma.product.updateMany({
        where: { groupId: product.groupId, id: { not: product.id } },
        data: sharedUpdate,
      });
    }
  }

  res.json(product);
});

/// Desvincula esta copia del producto de sus hermanas en otras tiendas: a partir de ahora
/// editarla no sincroniza ni se ve afectada por los cambios de las demás.
productsRouter.post("/:id/unlink", async (req, res) => {
  const product = await prisma.product.findUnique({ where: { id: req.params.id } });
  if (!product) return res.status(404).json({ error: "Producto no encontrado" });
  const updated = await prisma.product.update({
    where: { id: req.params.id },
    data: { groupId: req.params.id },
  });
  res.json(updated);
});

/// Disponibilidad multi-tienda: crea una copia independiente de este producto
/// (sin receta ni stock) en cada tienda indicada, compartiendo el mismo
/// groupId para que se reconozcan como "el mismo producto" en los reportes.
productsRouter.post("/:id/link-to-stores", async (req, res) => {
  const schema = z.object({ storeIds: z.array(z.string().min(1)).min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: zodMessage(parsed.error) });

  const source = await prisma.product.findUnique({ where: { id: req.params.id } });
  if (!source) return res.status(404).json({ error: "Producto no encontrado" });

  const groupId = source.groupId ?? source.id;
  if (!source.groupId) {
    await prisma.product.update({ where: { id: source.id }, data: { groupId } });
  }

  const created = await prisma.$transaction(
    parsed.data.storeIds.map((storeId) =>
      prisma.product.create({
        data: {
          storeId,
          groupId,
          name: source.name,
          description: source.description,
          category: source.category,
          color: source.color,
          tags: source.tags,
          unit: source.unit,
          unitPrice: source.unitPrice,
          coverPhoto: source.coverPhoto,
          photos: source.photos ?? undefined,
        },
      })
    )
  );
  res.status(201).json(created);
});
