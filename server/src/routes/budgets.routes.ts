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


function monthRangeOf(key: string): { start: Date; end: Date } {
  const [y, m] = key.split("-").map(Number);
  return { start: new Date(y, m - 1, 1), end: new Date(y, m, 1) };
}

/** Presupuesto de ventas por producto (igual que productBudgetData() del mockup): para cada
 * producto con ventas en el mes en curso o en los 3 anteriores, el presupuesto es la línea
 * manual si existe, o si no, el promedio de ventas reales de esos 3 meses previos — se
 * mezclan en una sola tabla en vez de requerir una acción aparte del usuario. */
// Admin sin storeId agrega entre todas las tiendas (vista "Todas las tiendas") — en ese caso
// no hay líneas manuales que mostrar, porque un presupuesto siempre se define por tienda.
budgetsRouter.get("/comparison", async (req, res) => {
  const storeId = resolveStoreId(req);
  if (!storeId && req.auth!.role !== "ADMIN") {
    return res.status(400).json({ error: "Falta seleccionar una tienda" });
  }

  const month = req.query.month as string | undefined;
  if (!month) return res.status(400).json({ error: "Falta el parámetro month (YYYY-MM)" });

  const priorKeys = [3, 2, 1].map((i) => shiftBudgetMonth(month, -i));
  const rangeStart = monthRangeOf(priorKeys[0]).start;
  const rangeEnd = monthRangeOf(month).end;

  const [orders, manualEntries] = await Promise.all([
    prisma.order.findMany({
      where: { ...(storeId ? { storeId } : {}), status: { not: "CANCELLED" }, createdAt: { gte: rangeStart, lt: rangeEnd } },
      include: { items: true },
    }),
    storeId ? prisma.budgetEntry.findMany({ where: { storeId, month } }) : Promise.resolve([]),
  ]);

  function monthlyRevenue(key: string): Map<string, number> {
    const { start, end } = monthRangeOf(key);
    const out = new Map<string, number>();
    orders
      .filter((o) => o.createdAt >= start && o.createdAt < end)
      .forEach((o) => o.items.forEach((it) => out.set(it.productName, (out.get(it.productName) ?? 0) + Number(it.subtotal))));
    return out;
  }
  const priorRevenues = priorKeys.map(monthlyRevenue);
  const currentRevenue = monthlyRevenue(month);
  const allNames = new Set<string>();
  priorRevenues.forEach((m) => m.forEach((_v, name) => allNames.add(name)));
  currentRevenue.forEach((_v, name) => allNames.add(name));
  const manualByName = new Map(manualEntries.map((e) => [e.productName, e]));

  const rows = Array.from(allNames)
    .map((name) => {
      const histValues = priorRevenues.map((m) => m.get(name) ?? 0);
      const sugerido = histValues.length ? histValues.reduce((s, v) => s + v, 0) / histValues.length : 0;
      const manual = manualByName.get(name);
      const presupuesto = manual ? Number(manual.amount) : sugerido;
      const real = currentRevenue.get(name) ?? 0;
      const cumplimiento = presupuesto > 0 ? (real / presupuesto) * 100 : real > 0 ? 100 : null;
      return { name, presupuesto, real, cumplimiento, manual: !!manual };
    })
    .sort((a, b) => b.presupuesto - a.presupuesto);

  res.json({ currentKey: month, priorMonthsCount: priorKeys.length, rows });
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

const budgetReplaceSchema = z.object({
  storeId: z.string().min(1),
  month: z.string().regex(/^\d{4}-\d{2}$/, "month debe tener formato YYYY-MM"),
  items: z.array(budgetItemSchema),
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

/** Reemplaza TODO el presupuesto de una tienda+mes de una sola vez (igual que el formulario
 * "Crear presupuesto" del mockup, que reconstruye data.budgets[storeId][mes] completo al
 * guardar): borra las líneas existentes de ese mes y crea las nuevas, en una transacción. */
budgetsRouter.put("/", requirePermission("finanzas"), async (req, res) => {
  const parsed = budgetReplaceSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: zodMessage(parsed.error) });
  }
  const { storeId, month, items } = parsed.data;

  if (req.auth!.role !== "ADMIN" && req.auth!.storeId !== storeId) {
    return res.status(403).json({ error: "No puedes definir el presupuesto de otra tienda" });
  }

  await prisma.$transaction([
    prisma.budgetEntry.deleteMany({ where: { storeId, month } }),
    ...items.map((item) =>
      prisma.budgetEntry.create({
        data: { storeId, month, productName: item.productName, quantity: item.quantity, unitPrice: item.unitPrice, amount: item.quantity * item.unitPrice },
      }),
    ),
  ]);
  const rows = await prisma.budgetEntry.findMany({ where: { storeId, month }, orderBy: { amount: "desc" } });
  res.json(rows);
});

budgetsRouter.delete("/:id", requirePermission("finanzas"), async (req, res) => {
  await prisma.budgetEntry.delete({ where: { id: req.params.id } });
  res.status(204).end();
});
