import { Router } from "express";
import { z } from "zod";
import { zodMessage } from "../lib/validation";
import { prisma } from "../lib/prisma";
import { requireAuth, resolveStoreId } from "../middleware/requireAuth";
import { requirePermission } from "../lib/permissions";

export const supplierInvoicesRouter = Router();

supplierInvoicesRouter.use(requireAuth);
supplierInvoicesRouter.use(requirePermission("insumos"));

const invoiceInclude = {
  supplier: { select: { id: true, name: true } },
  items: { include: { supply: true } },
} as const;

supplierInvoicesRouter.get("/", async (req, res) => {
  const storeId = resolveStoreId(req);
  if (!storeId) return res.status(400).json({ error: "Falta seleccionar una tienda" });

  const invoices = await prisma.supplierInvoice.findMany({
    where: { storeId },
    include: invoiceInclude,
    orderBy: { date: "desc" },
  });
  res.json(invoices);
});

const invoiceItemSchema = z.object({
  supplyId: z.string().min(1),
  quantity: z.number().positive(),
  unitCost: z.number().positive(),
});

const invoiceSchema = z.object({
  storeId: z.string().min(1),
  supplierId: z.string().min(1),
  invoiceNumber: z.string().min(1),
  date: z.string().datetime(),
  items: z.array(invoiceItemSchema).min(1),
});

supplierInvoicesRouter.post("/", async (req, res) => {
  const parsed = invoiceSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: zodMessage(parsed.error) });
  }
  const { storeId, supplierId, invoiceNumber, date, items } = parsed.data;

  if (req.auth!.role !== "ADMIN" && req.auth!.storeId !== storeId) {
    return res.status(403).json({ error: "No puedes registrar facturas para otra tienda" });
  }

  try {
    const invoice = await prisma.$transaction(async (tx) => {
      const supplies = await tx.supply.findMany({
        where: { id: { in: items.map((i) => i.supplyId) }, storeId },
      });
      if (supplies.length !== items.length) {
        throw new Error("Uno o más insumos no existen en esta tienda");
      }

      let total = 0;
      for (const item of items) {
        const supply = supplies.find((s) => s.id === item.supplyId)!;
        const currentStock = Number(supply.stock);
        const currentCost = Number(supply.costPerUnit);
        const newStock = currentStock + item.quantity;
        const newCostPerUnit =
          newStock > 0
            ? (currentStock * currentCost + item.quantity * item.unitCost) / newStock
            : item.unitCost;

        await tx.supply.update({
          where: { id: supply.id },
          data: { stock: newStock, costPerUnit: newCostPerUnit },
        });

        total += item.quantity * item.unitCost;
      }

      const created = await tx.supplierInvoice.create({
        data: {
          storeId,
          supplierId,
          invoiceNumber,
          date: new Date(date),
          total,
          items: {
            create: items.map((item) => ({
              supplyId: item.supplyId,
              quantity: item.quantity,
              unitCost: item.unitCost,
            })),
          },
        },
        include: invoiceInclude,
      });

      return created;
    });

    res.status(201).json(invoice);
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudo registrar la factura";
    res.status(400).json({ error: message });
  }
});
