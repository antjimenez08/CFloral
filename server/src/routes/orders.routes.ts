import { Router } from "express";
import { z } from "zod";
import { zodMessage } from "../lib/validation";
import { prisma } from "../lib/prisma";
import { requireAuth, resolveStoreId } from "../middleware/requireAuth";

export const ordersRouter = Router();

ordersRouter.use(requireAuth);

const orderStatus = z.enum([
  "PENDING",
  "IN_PROGRESS",
  "READY_FOR_PICKUP",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
]);
const paymentStatus = z.enum(["UNPAID", "PARTIAL", "PAID"]);
const contactChannel = z.enum([
  "WALK_IN",
  "PHONE",
  "WHATSAPP",
  "EMAIL",
  "WEBSITE",
  "SOCIAL_MEDIA",
  "MARKETPLACE",
  "REFERRAL",
  "OTHER",
]);
const occasion = z.enum([
  "BIRTHDAY",
  "ANNIVERSARY",
  "SYMPATHY",
  "WEDDING",
  "GET_WELL",
  "CONGRATULATIONS",
  "ROMANCE",
  "NEW_BABY",
  "GRADUATION",
  "CORPORATE",
  "MOTHERS_DAY",
  "VALENTINES",
  "NO_OCCASION",
  "OTHER",
]);
const deliveryMethod = z.enum(["PICKUP", "DELIVERY"]);

ordersRouter.get("/", async (req, res) => {
  const storeId = resolveStoreId(req);
  if (!storeId) return res.status(400).json({ error: "Falta seleccionar una tienda" });

  const status = req.query.status as string | undefined;
  const occasionFilter = req.query.occasion as string | undefined;
  const orders = await prisma.order.findMany({
    where: {
      storeId,
      ...(status ? { status: status as never } : {}),
      ...(occasionFilter ? { occasion: occasionFilter as never } : {}),
    },
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
      assignedTo: { select: { id: true, name: true } },
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
  channel: contactChannel.optional(),
  occasion: occasion.optional(),
  isRush: z.boolean().optional(),
  recipientName: z.string().optional(),
  recipientPhone: z.string().optional(),
  recipientRelationship: z.string().optional(),
  cardMessage: z.string().optional(),
  deliveryMethod: deliveryMethod.optional(),
  deliveryAddress: z.string().optional(),
  deliveryCity: z.string().optional(),
  deliveryWindow: z.string().optional(),
  assignedToId: z.string().optional(),
  discount: z.number().nonnegative().optional(),
  deliveryFee: z.number().nonnegative().optional(),
  externalReference: z.string().optional(),
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
  const { storeId, customerId, deliveryDate, items, discount, deliveryFee, ...rest } = parsed.data;

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

      const discountAmount = discount ?? 0;
      const deliveryFeeAmount = deliveryFee ?? 0;
      const total = Math.max(0, subtotal - discountAmount + deliveryFeeAmount);

      const orderCount = await tx.order.count();
      const invoiceNumber = `F-${String(orderCount + 1).padStart(6, "0")}`;

      const created = await tx.order.create({
        data: {
          ...rest,
          invoiceNumber,
          storeId,
          customerId,
          createdById: req.auth!.userId,
          deliveryDate: deliveryDate ? new Date(deliveryDate) : undefined,
          subtotal,
          discount: discountAmount,
          deliveryFee: deliveryFeeAmount,
          total,
          items: { create: orderItemsData },
        },
        include: { items: { include: { product: true } }, customer: true },
      });

      // Estadísticas RFM del cliente: recencia, frecuencia y valor monetario.
      await tx.customer.update({
        where: { id: customerId },
        data: {
          lastOrderAt: created.createdAt,
          ordersCount: { increment: 1 },
          lifetimeValue: { increment: total },
        },
      });

      return created;
    });

    res.status(201).json(order);
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudo crear el pedido";
    res.status(400).json({ error: message });
  }
});

const updateOrderSchema = z.object({
  status: orderStatus.optional(),
  paymentStatus: paymentStatus.optional(),
  assignedToId: z.string().optional(),
  rating: z.number().int().min(1).max(5).optional(),
  ratingComment: z.string().optional(),
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
