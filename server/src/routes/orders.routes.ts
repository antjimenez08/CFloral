import { Router } from "express";
import { z } from "zod";
import { zodMessage } from "../lib/validation";
import { prisma } from "../lib/prisma";
import { requireAuth, resolveStoreId } from "../middleware/requireAuth";

export const ordersRouter = Router();

ordersRouter.use(requireAuth);

ordersRouter.get("/", async (req, res) => {
  const storeId = resolveStoreId(req);
  if (!storeId) return res.status(400).json({ error: "Falta seleccionar una tienda" });

  const status = req.query.status as string | undefined;
  const orders = await prisma.order.findMany({
    where: { storeId, ...(status ? { status: status as never } : {}) },
    include: { customer: true, items: { include: { product: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json(orders);
});

ordersRouter.get("/:id", async (req, res) => {
  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: {
      customer: true,
      store: true,
      createdBy: { select: { id: true, name: true } },
      items: { include: { product: true } },
    },
  });
  if (!order) return res.status(404).json({ error: "Pedido no encontrado" });
  res.json(order);
});

const createOrderSchema = z.object({
  storeId: z.string().min(1),
  customerId: z.string().min(1),
  deliveryDate: z.string().datetime().optional(),
  notes: z.string().optional(),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().positive(),
      }),
    )
    .min(1),
});

ordersRouter.post("/", async (req, res) => {
  const parsed = createOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: zodMessage(parsed.error) });
  }
  const { storeId, customerId, deliveryDate, notes, items } = parsed.data;

  if (req.auth!.role !== "ADMIN" && req.auth!.storeId !== storeId) {
    return res.status(403).json({ error: "No puedes crear pedidos para otra tienda" });
  }

  try {
    const order = await prisma.$transaction(async (tx) => {
      const products = await tx.product.findMany({
        where: { id: { in: items.map((i) => i.productId) }, storeId },
      });
      if (products.length !== items.length) {
        throw new Error("Uno o más productos no existen en esta tienda");
      }

      let subtotal = 0;
      const orderItemsData = items.map((item) => {
        const product = products.find((p) => p.id === item.productId)!;
        if (product.stock < item.quantity) {
          throw new Error(`Stock insuficiente para "${product.name}" (disponible: ${product.stock})`);
        }
        const unitPrice = Number(product.unitPrice);
        const lineSubtotal = unitPrice * item.quantity;
        subtotal += lineSubtotal;
        return {
          productId: product.id,
          quantity: item.quantity,
          unitPrice,
          subtotal: lineSubtotal,
        };
      });

      for (const item of items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        });
      }

      const orderCount = await tx.order.count();
      const invoiceNumber = `F-${String(orderCount + 1).padStart(6, "0")}`;

      return tx.order.create({
        data: {
          invoiceNumber,
          storeId,
          customerId,
          createdById: req.auth!.userId,
          deliveryDate: deliveryDate ? new Date(deliveryDate) : undefined,
          notes,
          subtotal,
          total: subtotal,
          items: { create: orderItemsData },
        },
        include: { items: { include: { product: true } }, customer: true },
      });
    });

    res.status(201).json(order);
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudo crear el pedido";
    res.status(400).json({ error: message });
  }
});

const updateOrderSchema = z.object({
  status: z.enum(["PENDING", "IN_PROGRESS", "DELIVERED", "CANCELLED"]).optional(),
  paymentStatus: z.enum(["UNPAID", "PARTIAL", "PAID"]).optional(),
});

ordersRouter.patch("/:id", async (req, res) => {
  const parsed = updateOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: zodMessage(parsed.error) });
  }
  const order = await prisma.order.update({
    where: { id: req.params.id },
    data: parsed.data,
    include: { customer: true, items: { include: { product: true } } },
  });
  res.json(order);
});
