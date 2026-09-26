import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, resolveStoreId } from "../middleware/requireAuth";

export const financeRouter = Router();

financeRouter.use(requireAuth);

/**
 * Resumen financiero de una tienda en un rango de fechas: ventas (pedidos no
 * cancelados), costo de venta (aproximado con el costPrice actual del
 * producto — no queda un snapshot histórico por pedido en este MVP),
 * gastos e inversiones (de Expense), y EBITDA simple = ventas - costos - gastos.
 */
financeRouter.get("/summary", async (req, res) => {
  const storeId = resolveStoreId(req);
  if (!storeId) return res.status(400).json({ error: "Falta seleccionar una tienda" });

  const { from, to } = req.query as Record<string, string | undefined>;
  const dateFilter = {
    ...(from ? { gte: new Date(from) } : {}),
    ...(to ? { lte: new Date(to) } : {}),
  };

  const orders = await prisma.order.findMany({
    where: {
      storeId,
      status: { not: "CANCELLED" },
      ...(from || to ? { createdAt: dateFilter } : {}),
    },
    include: { items: { include: { product: true } } },
  });

  const ventas = orders.reduce((sum, o) => sum + Number(o.total), 0);
  const costos = orders.reduce(
    (sum, o) =>
      sum +
      o.items.reduce((s, it) => s + Number(it.product.costPrice ?? 0) * it.quantity, 0),
    0,
  );

  const expenses = await prisma.expense.findMany({
    where: { storeId, ...(from || to ? { date: dateFilter } : {}) },
  });
  const gastos = expenses.filter((e) => e.type === "EXPENSE").reduce((s, e) => s + Number(e.amount), 0);
  const costosRegistrados = expenses.filter((e) => e.type === "COST").reduce((s, e) => s + Number(e.amount), 0);
  const inversiones = expenses.filter((e) => e.type === "INVESTMENT").reduce((s, e) => s + Number(e.amount), 0);

  const costosTotal = costos + costosRegistrados;
  const ebitda = ventas - costosTotal - gastos;

  res.json({
    ventas,
    costos: costosTotal,
    gastos,
    inversiones,
    ebitda,
    ebitdaPct: ventas > 0 ? (ebitda / ventas) * 100 : 0,
    ordersCount: orders.length,
  });
});
