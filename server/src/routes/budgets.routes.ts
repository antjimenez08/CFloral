import { Router } from "express";
import { z } from "zod";
import { zodMessage } from "../lib/validation";
import { prisma } from "../lib/prisma";
import { requireAuth, resolveStoreId } from "../middleware/requireAuth";
import { requirePermission } from "../lib/permissions";

export const budgetsRouter = Router();

budgetsRouter.use(requireAuth);

/// GET es de solo lectura (cualquier usuario autenticado con acceso a la tienda puede
/// consultar el presupuesto); crear/editar/eliminar requiere el permiso "finanzas"
/// (los presupuestos viven dentro de la pestaña Finanzas del mockup).
budgetsRouter.get("/", async (req, res) => {
  const storeId = resolveStoreId(req);
  if (!storeId) return res.status(400).json({ error: "Falta seleccionar una tienda" });

  const month = req.query.month as string | undefined;
  if (!month) return res.status(400).json({ error: "Falta el parámetro month (YYYY-MM)" });

  const entries = await prisma.budgetEntry.findMany({
    where: { storeId, month },
    orderBy: { amount: "desc" },
  });
  res.json(entries);
});

const budgetItemSchema = z.object({
  productName: z.string().min(1),
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative(),
});

const budgetSchema = z.object({
  storeId: z.string().min(1),
  month: z.string().regex(/^\d{4}-\d{2}$/, "month debe tener formato YYYY-MM"),
  items: z.array(budgetItemSchema).min(1),
});

budgetsRouter.post("/", requirePermission("finanzas"), async (req, res) => {
  const parsed = budgetSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: zodMessage(parsed.error) });
  }
  const { storeId, month, items } = parsed.data;

  if (req.auth!.role !== "ADMIN" && req.auth!.storeId !== storeId) {
    return res.status(403).json({ error: "No puedes definir el presupuesto de otra tienda" });
  }

  const rows = await prisma.$transaction(
    items.map((item) => {
      const amount = item.quantity * item.unitPrice;
      return prisma.budgetEntry.upsert({
        where: { storeId_month_productName: { storeId, month, productName: item.productName } },
        update: { quantity: item.quantity, unitPrice: item.unitPrice, amount },
        create: {
          storeId,
          month,
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          amount,
        },
      });
    }),
  );

  res.status(201).json(rows);
});

budgetsRouter.delete("/:id", requirePermission("finanzas"), async (req, res) => {
  await prisma.budgetEntry.delete({ where: { id: req.params.id } });
  res.status(204).end();
});
