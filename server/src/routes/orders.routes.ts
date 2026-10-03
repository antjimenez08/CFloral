import { Router } from "express";
import { z } from "zod";
import { zodMessage } from "../lib/validation";
import { prisma } from "../lib/prisma";
import { requireAuth, resolveStoreId } from "../middleware/requireAuth";

export const ordersRouter = Router();

ordersRouter.use(requireAuth);

const orderStatus = z.enum(["PENDING", "IN_PROGRESS", "READY", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"]);
const paymentStatus = z.enum(["UNPAID", "PARTIAL", "PAID"]);

/// null o "" significan "borrar la fecha programada" (se envían a propósito); sin el campo
/// en el body, el valor es undefined y Prisma deja la fecha como estaba.
function deliveryDateUpdate(value: string | null | undefined): Date | null | undefined {
  if (value === null || value === "") return null;
  if (value === undefined) return undefined;
  return new Date(value);
}

const orderInclude = {
  customer: true,
  recipientPersona: { include: { addresses: true } },
  deliveryPerson: { select: { id: true, name: true } },
  items: { include: { product: true } },
} as const;

// Admin sin storeId ve los pedidos de todas las tiendas (vista "Todas las tiendas"
// de Finanzas: tendencias, categorías y desempeño de productos del dashboard).
ordersRouter.get("/", async (req, res) => {
  const storeId = resolveStoreId(req);
  if (!storeId && req.auth!.role !== "ADMIN") {
    return res.status(400).json({ error: "Falta seleccionar una tienda" });
  }

  const status = req.query.status as string | undefined;
  const orders = await prisma.order.findMany({
    where: { ...(storeId ? { storeId } : {}), ...(status ? { status: status as never } : {}) },
    include: orderInclude,
    orderBy: { createdAt: "desc" },
  });
  res.json(orders);
});

ordersRouter.get("/:id", async (req, res) => {
  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: {
      ...orderInclude,
      store: true,
      createdBy: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true } },
    },
  });
  if (!order) return res.status(404).json({ error: "Pedido no encontrado" });
  res.json(order);
});

const orderFieldsSchema = z.object({
  storeId: z.string().min(1),
  customerId: z.string().min(1),
  recipientPersonaId: z.string().nullable().optional(),
  recipientName: z.string().nullable().optional(),
  recipientPhone: z.string().nullable().optional(),
  deliveryAddress: z.string().nullable().optional(),
  deliveryCity: z.string().nullable().optional(),
  deliveryDate: z.string().datetime().optional().or(z.literal("")).nullable(),
  scheduledShift: z.string().nullable().optional(),
  scheduledHour: z.string().nullable().optional(),
  deliveryPersonId: z.string().nullable().optional(),
  isThirdPartyDelivery: z.boolean().optional(),
  thirdPartyDriverName: z.string().nullable().optional(),
  thirdPartyPlate: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  paymentMethod: z.string().nullable().optional(),
  occasion: z.string().nullable().optional(),
  cardMessage: z.string().nullable().optional(),
  assignedToId: z.string().nullable().optional(),
  discount: z.number().nonnegative().optional(),
  deliveryFee: z.number().nonnegative().optional(),
  externalReference: z.string().nullable().optional(),
  items: z
    .array(z.object({ productId: z.string().min(1), quantity: z.number().int().positive() }))
    .min(1),
});

async function nextInvoiceNumber(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]): Promise<string> {
  const settings = await tx.companySettings.upsert({
    where: { id: "singleton" },
    update: { nextInvoiceNumber: { increment: 1 } },
    create: { id: "singleton", nextInvoiceNumber: 2 },
  });
  const assigned = settings.nextInvoiceNumber - 1;
  return `CP-${String(assigned).padStart(6, "0")}`;
}

ordersRouter.post("/", async (req, res) => {
  const parsed = orderFieldsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: zodMessage(parsed.error) });
  }
  const { storeId, customerId, items, discount, deliveryFee, deliveryDate, ...rest } = parsed.data;

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
          productName: product.name,
          quantity: item.quantity,
          unitPrice,
          subtotal: lineSubtotal,
        };
      });

      for (const item of items) {
        await tx.product.update({ where: { id: item.productId }, data: { stock: { decrement: item.quantity } } });
      }

      const discountAmount = discount ?? 0;
      const deliveryFeeAmount = deliveryFee ?? 0;
      const total = Math.max(0, subtotal - discountAmount + deliveryFeeAmount);
      const invoiceNumber = await nextInvoiceNumber(tx);

      const created = await tx.order.create({
        data: {
          ...rest,
          invoiceNumber,
          storeId,
          customerId,
          createdById: req.auth!.userId,
          deliveryDate: deliveryDateUpdate(deliveryDate),
          subtotal,
          discount: discountAmount,
          deliveryFee: deliveryFeeAmount,
          total,
          items: { create: orderItemsData },
        },
        include: orderInclude,
      });

      await tx.customer.update({
        where: { id: customerId },
        data: { lastOrderAt: created.createdAt, ordersCount: { increment: 1 }, lifetimeValue: { increment: total } },
      });

      return created;
    });

    res.status(201).json(order);
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudo crear el pedido";
    res.status(400).json({ error: message });
  }
});

/// Edición completa del pedido (igual que "editar pedido" del mockup): devuelve
/// al inventario el stock de los items anteriores, valida y descuenta de nuevo,
/// recalcula el total — pero conserva invoiceNumber/status/paymentStatus.
ordersRouter.put("/:id", async (req, res) => {
  const parsed = orderFieldsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: zodMessage(parsed.error) });
  }
  const { storeId, customerId, items, discount, deliveryFee, deliveryDate, ...rest } = parsed.data;

  try {
    const order = await prisma.$transaction(async (tx) => {
      const existing = await tx.order.findUnique({ where: { id: req.params.id }, include: { items: true } });
      if (!existing) throw new Error("Pedido no encontrado");

      for (const oldItem of existing.items) {
        await tx.product.update({ where: { id: oldItem.productId }, data: { stock: { increment: oldItem.quantity } } });
      }
      await tx.orderItem.deleteMany({ where: { orderId: existing.id } });

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
          productName: product.name,
          quantity: item.quantity,
          unitPrice,
          subtotal: lineSubtotal,
        };
      });

      for (const item of items) {
        await tx.product.update({ where: { id: item.productId }, data: { stock: { decrement: item.quantity } } });
      }

      const discountAmount = discount ?? 0;
      const deliveryFeeAmount = deliveryFee ?? 0;
      const total = Math.max(0, subtotal - discountAmount + deliveryFeeAmount);

      return tx.order.update({
        where: { id: existing.id },
        data: {
          ...rest,
          storeId,
          customerId,
          deliveryDate: deliveryDateUpdate(deliveryDate),
          subtotal,
          discount: discountAmount,
          deliveryFee: deliveryFeeAmount,
          total,
          items: { create: orderItemsData },
        },
        include: orderInclude,
      });
    });

    res.json(order);
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudo editar el pedido";
    res.status(400).json({ error: message });
  }
});

/// Agrupa los pedidos DELIVERED en bloques consecutivos de 5 (en orden de
/// creación) y, la primera vez que un bloque queda completo, sortea cuál de
/// los 5 recibe la encuesta de satisfacción — igual que resolveSurveyGroups()
/// del mockup.
async function runSurveySelection() {
  const delivered = await prisma.order.findMany({
    where: { status: "DELIVERED" },
    orderBy: { createdAt: "asc" },
    select: { id: true, surveySelected: true },
  });
  for (let i = 0; i + 5 <= delivered.length; i += 5) {
    const group = delivered.slice(i, i + 5);
    if (group.some((o) => o.surveySelected !== null)) continue;
    const winnerIdx = Math.floor(Math.random() * 5);
    await prisma.$transaction(
      group.map((o, idx) => prisma.order.update({ where: { id: o.id }, data: { surveySelected: idx === winnerIdx } }))
    );
  }
}

const updateOrderSchema = z.object({
  status: orderStatus.optional(),
  paymentStatus: paymentStatus.optional(),
  assignedToId: z.string().nullable().optional(),
  rating: z.number().int().min(1).max(5).optional(),
  ratingComment: z.string().nullable().optional(),
  qCalidad: z.number().int().min(1).max(5).optional(),
  qPuntualidad: z.number().int().min(1).max(5).optional(),
  qRecomendacion: z.number().int().min(1).max(5).optional(),
  surveyNotes: z.string().nullable().optional(),
  deliveryPersonId: z.string().nullable().optional(),
  isThirdPartyDelivery: z.boolean().optional(),
  thirdPartyDriverName: z.string().nullable().optional(),
  thirdPartyPlate: z.string().nullable().optional(),
  deliveryDate: z.string().datetime().optional().or(z.literal("")).nullable(),
  scheduledShift: z.string().nullable().optional(),
  scheduledHour: z.string().nullable().optional(),
  notifiedStatus: orderStatus.optional(),
  cardPrinted: z.boolean().optional(),
  dispatchPrinted: z.boolean().optional(),
});

ordersRouter.patch("/:id", async (req, res) => {
  const parsed = updateOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: zodMessage(parsed.error) });
  }
  const { deliveryDate, ...rest } = parsed.data;
  const order = await prisma.order.update({
    where: { id: req.params.id },
    data: { ...rest, deliveryDate: deliveryDateUpdate(deliveryDate) },
    include: orderInclude,
  });
  if (parsed.data.status === "DELIVERED") {
    await runSurveySelection();
  }
  res.json(order);
});
