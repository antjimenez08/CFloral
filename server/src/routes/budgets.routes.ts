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
/// (los presupuestos viven dentro de la pestaña Finanzas del mockup). Admin sin
/// storeId ve el presupuesto de todas las tiendas (vista "Todas las tiendas").
budgetsRouter.get("/", async (req, res) => {
  const storeId = resolveStoreId(req);
  if (!storeId && req.auth!.role !== "ADMIN") {
    return res.status(400).json({ error: "Falta seleccionar una tienda" });
  }

  const month = req.query.month as string | undefined;
  if (!month) return res.status(400).json({ error: "Falta el parámetro month (YYYY-MM)" });

  const entries = await prisma.budgetEntry.findMany({
    where: { ...(storeId ? { storeId } : {}), month },
    orderBy: { amount: "desc" },
  });
  res.json(entries);
});

function shiftBudgetMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Sugerencia de presupuesto = promedio de ventas reales (cantidad y valor) de cada
 * producto en los 3 meses anteriores a `month`, para que el usuario no parta de cero. */
budgetsRouter.get("/suggestions", async (req, res) => {
  const storeId = resolveStoreId(req);
  if (!storeId) return res.status(400).json({ error: "Falta seleccionar una tienda" });

  const month = req.query.month as string | undefined;
  if (!month) return res.status(400).json({ error: "Falta el parámetro month (YYYY-MM)" });

  const [startY, startM] = shiftBudgetMonth(month, -3).split("-").map(Number);
  const [endY, endM] = month.split("-").map(Number);
  const start = new Date(startY, startM - 1, 1);
  const end = new Date(endY, endM - 1, 1);

  const orders = await prisma.order.findMany({
    where: { storeId, status: { not: "CANCELLED" }, createdAt: { gte: start, lt: end } },
    include: { items: true },
  });

  const monthsSeen = new Set<string>();
  const byProduct = new Map<string, { quantity: number; revenue: number }>();
  for (const order of orders) {
    monthsSeen.add(`${order.createdAt.getFullYear()}-${String(order.createdAt.getMonth() + 1).padStart(2, "0")}`);
    for (const item of order.items) {
      const row = byProduct.get(item.productName) ?? { quantity: 0, revenue: 0 };
      row.quantity += item.quantity;
      row.revenue += Number(item.subtotal);
      byProduct.set(item.productName, row);
    }
  }
  const monthsWithData = Math.max(1, monthsSeen.size);

  const suggestions = Array.from(byProduct.entries())
    .map(([productName, row]) => {
      const quantity = Math.max(1, Math.round(row.quantity / monthsWithData));
      const unitPrice = row.quantity > 0 ? row.revenue / row.quantity : 0;
      return { productName, quantity, unitPrice: Math.round(unitPrice) };
    })
    .sort((a, b) => b.quantity * b.unitPrice - a.quantity * a.unitPrice);

  res.json(suggestions);
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
