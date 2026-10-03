import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, resolveStoreId } from "../middleware/requireAuth";
import { can, requirePermission } from "../lib/permissions";

export const financeRouter = Router();

financeRouter.use(requireAuth);
financeRouter.use(requirePermission("finanzas"));

/// Categorías que restan a la utilidad neta pero se suman de vuelta para el
/// EBITDA (igual que EBITDA_EXCLUDED_CATEGORIES del mockup).
export const EBITDA_EXCLUDED_CATEGORIES = ["Depreciación", "Intereses financieros", "Impuestos"];

/// ---------------------------------------------------------------------------
/// Helpers compartidos por /summary, /evolution, /reports y /recommendations.
/// ---------------------------------------------------------------------------

const orderWithItemsInclude = {
  items: { include: { product: { select: { id: true, name: true, costPrice: true } } } },
} satisfies Prisma.OrderInclude;

type OrderWithItems = Prisma.OrderGetPayload<{ include: typeof orderWithItemsInclude }>;

interface ExpenseLike {
  type: string;
  category: string;
  amount: Prisma.Decimal;
}

interface FinanceMetrics {
  ventas: number;
  costos: number;
  gastos: number;
  inversiones: number;
  ebitda: number;
  ebitdaPct: number;
  ordersCount: number;
}

/** Igual cálculo que antes vivía inline en /summary: costo de venta aproximado con
 * el costPrice actual del producto (no hay snapshot histórico por pedido en este MVP). */
function computeFinanceMetrics(orders: OrderWithItems[], expenses: ExpenseLike[]): FinanceMetrics {
  const ventas = orders.reduce((sum, o) => sum + Number(o.total), 0);
  const costos = orders.reduce(
    (sum, o) => sum + o.items.reduce((s, it) => s + Number(it.product.costPrice ?? 0) * it.quantity, 0),
    0,
  );
  const gastos = expenses.filter((e) => e.type === "GASTO" || e.type === "OTRO").reduce((s, e) => s + Number(e.amount), 0);
  const costosRegistrados = expenses.filter((e) => e.type === "COSTO").reduce((s, e) => s + Number(e.amount), 0);
  const inversiones = expenses.filter((e) => e.type === "INVERSION").reduce((s, e) => s + Number(e.amount), 0);

  const costosTotal = costos + costosRegistrados;
  const noOperativos = expenses
    .filter((e) => e.type !== "INVERSION" && EBITDA_EXCLUDED_CATEGORIES.includes(e.category))
    .reduce((s, e) => s + Number(e.amount), 0);
  const ebitda = ventas - costosTotal - gastos + noOperativos;

  return {
    ventas,
    costos: costosTotal,
    gastos,
    inversiones,
    ebitda,
    ebitdaPct: ventas > 0 ? (ebitda / ventas) * 100 : 0,
    ordersCount: orders.length,
  };
}

/**
 * Resumen financiero en un rango de fechas: ventas, costos, gastos, inversiones y
 * EBITDA. Para ADMIN sin storeId se agrega entre TODAS las tiendas y además se
 * devuelve el desglose por tienda (byStore), para "Comparativo de gestión por
 * tienda" y "Ventas por tienda" en el dashboard.
 */
financeRouter.get("/summary", async (req, res) => {
  const storeId = resolveStoreId(req);
  if (!storeId && req.auth!.role !== "ADMIN") {
    return res.status(400).json({ error: "Falta seleccionar una tienda" });
  }
  const storeWhere = storeId ? { storeId } : {};

  const { from, to } = req.query as Record<string, string | undefined>;
  const dateFilter = {
    ...(from ? { gte: new Date(from) } : {}),
    ...(to ? { lte: new Date(to) } : {}),
  };

  const [orders, expenses] = await Promise.all([
    prisma.order.findMany({
      where: {
        ...storeWhere,
        status: { not: "CANCELLED" },
        ...(from || to ? { createdAt: dateFilter } : {}),
      },
      include: orderWithItemsInclude,
    }),
    prisma.expense.findMany({
      where: { ...storeWhere, ...(from || to ? { date: dateFilter } : {}) },
    }),
  ]);

  const overall = computeFinanceMetrics(orders, expenses);

  let byStore: (FinanceMetrics & { storeId: string; name: string })[] | undefined;
  if (!storeId) {
    const stores = await prisma.store.findMany({ select: { id: true, name: true } });
    byStore = stores.map((s) => ({
      storeId: s.id,
      name: s.name,
      ...computeFinanceMetrics(
        orders.filter((o) => o.storeId === s.id),
        expenses.filter((e) => e.storeId === s.id),
      ),
    }));
  }

  res.json({ ...overall, byStore });
});

/**
 * Evolución mensual (últimos 6 meses) de Ventas/Costos/Gastos/Inversiones/Utilidad,
 * para el gráfico de 5 series del dashboard. Admin sin storeId agrega todas las tiendas.
 */
financeRouter.get("/evolution", async (req, res) => {
  const storeId = resolveStoreId(req);
  if (!storeId && req.auth!.role !== "ADMIN") {
    return res.status(400).json({ error: "Falta seleccionar una tienda" });
  }
  const storeWhere = storeId ? { storeId } : {};

  const currentKey = monthKey(new Date());
  const monthKeys: string[] = [];
  for (let i = 5; i >= 0; i--) monthKeys.push(shiftMonthKey(currentKey, -i));
  const rangeStart = monthRange(monthKeys[0]).start;

  const [orders, expenses] = await Promise.all([
    prisma.order.findMany({
      where: { ...storeWhere, status: { not: "CANCELLED" }, createdAt: { gte: rangeStart } },
      include: orderWithItemsInclude,
    }),
    prisma.expense.findMany({ where: { ...storeWhere, date: { gte: rangeStart } } }),
  ]);

  const months = monthKeys.map((key) => {
    const { start, end } = monthRange(key);
    const monthOrders = orders.filter((o) => o.createdAt >= start && o.createdAt < end);
    const monthExpenses = expenses.filter((e) => e.date >= start && e.date < end);
    const m = computeFinanceMetrics(monthOrders, monthExpenses);
    return { month: key, ventas: m.ventas, costos: m.costos, gastos: m.gastos, inversiones: m.inversiones, utilidad: m.ebitda };
  });

  res.json(months);
});

/** Igual que orderCOGS() del mockup (§4.2): suma costPrice actual * cantidad por item. */
function orderCOGS(order: OrderWithItems): number {
  return order.items.reduce((sum, it) => sum + Number(it.product.costPrice ?? 0) * it.quantity, 0);
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonthKey(key: string, delta: number): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return monthKey(d);
}

function monthRange(key: string): { start: Date; end: Date } {
  const [y, m] = key.split("-").map(Number);
  return { start: new Date(y, m - 1, 1), end: new Date(y, m, 1) };
}

function daysBetween(a: Date, b: Date): number {
  return Math.abs(Number(b) - Number(a)) / 86400000;
}

/** delta(cur,prev) del mockup: % de cambio, null si no hay mes previo o prev===0. */
function pctDelta(cur: number, prev: number | null): number | null {
  if (prev === null || prev === 0) return null;
  return ((cur - prev) / prev) * 100;
}

interface MonthMetrics {
  ventas: number;
  pedidos: number;
  ticket: number;
  margen: number;
  satisfaccion: number | null;
}

/** monthMetrics() del mockup (§4.4): costos = COGS del mes + gastos tipo "Costo" registrados. */
function computeMonthMetrics(orders: OrderWithItems[], costoExpensesTotal: number): MonthMetrics {
  const ventas = orders.reduce((s, o) => s + Number(o.total), 0);
  const pedidos = orders.length;
  const ticket = pedidos > 0 ? ventas / pedidos : 0;
  const cogs = orders.reduce((s, o) => s + orderCOGS(o), 0);
  const costos = cogs + costoExpensesTotal;
  const margen = ventas > 0 ? ((ventas - costos) / ventas) * 100 : 0;
  const rated = orders.filter((o): o is OrderWithItems & { rating: number } => o.rating !== null);
  const satisfaccion = rated.length > 0 ? rated.reduce((s, o) => s + o.rating, 0) / rated.length : null;
  return { ventas, pedidos, ticket, margen, satisfaccion };
}

interface ProductStat {
  productId: string;
  name: string;
  qtySold: number;
  revenue: number;
  profitPct: number | null;
}

/** productPerformanceStats() del mockup (§4.8), simplificado a nivel de producto (no por groupId). */
function computeProductStats(
  products: { id: string; name: string; costPrice: Prisma.Decimal | null }[],
  orders: OrderWithItems[],
): ProductStat[] {
  const statsMap = new Map<string, { qtySold: number; revenue: number; costPrice: number | null }>();
  for (const p of products) {
    statsMap.set(p.id, { qtySold: 0, revenue: 0, costPrice: p.costPrice !== null ? Number(p.costPrice) : null });
  }
  for (const order of orders) {
    for (const item of order.items) {
      const entry = statsMap.get(item.productId);
      if (!entry) continue;
      entry.qtySold += item.quantity;
      entry.revenue += Number(item.subtotal);
    }
  }
  return products.map((p) => {
    const s = statsMap.get(p.id)!;
    const profit = s.costPrice !== null ? s.revenue - s.costPrice * s.qtySold : null;
    const profitPct = profit !== null && s.revenue > 0 ? (profit / s.revenue) * 100 : null;
    return { productId: p.id, name: p.name, qtySold: s.qtySold, revenue: s.revenue, profitPct };
  });
}

/**
 * Reportes gerenciales (§4.4 del mockup): KPIs mes actual vs mes anterior con su
 * variación %, nuevos/recurrentes/inactivos, top clientes, rotación de productos
 * y proyección de ventas. Para ADMIN sin storeId se agrega entre TODAS las tiendas.
 */
financeRouter.get("/reports", async (req, res) => {
  const storeId = resolveStoreId(req);
  if (req.auth!.role !== "ADMIN" && !storeId) {
    return res.status(400).json({ error: "Falta seleccionar una tienda" });
  }
  const storeWhere = storeId ? { storeId } : {};

  const currentKey = monthKey(new Date());
  const priorKey = shiftMonthKey(currentKey, -1);
  const current = monthRange(currentKey);

  // Historial de ventas (6 meses atrás + mes en curso) — liviano, solo para ubicar
  // "el último mes con datos" al comparar y para la tabla de tendencia de 6 meses.
  const historyStart = monthRange(shiftMonthKey(currentKey, -6)).start;
  const [currentOrders, currentCostoExpenses, historyOrders] = await Promise.all([
    prisma.order.findMany({
      where: { ...storeWhere, status: { not: "CANCELLED" }, createdAt: { gte: current.start, lt: current.end } },
      include: orderWithItemsInclude,
    }),
    prisma.expense.findMany({
      where: { ...storeWhere, type: "COSTO", date: { gte: current.start, lt: current.end } },
    }),
    prisma.order.findMany({
      where: { ...storeWhere, status: { not: "CANCELLED" }, createdAt: { gte: historyStart } },
      select: { total: true, createdAt: true },
    }),
  ]);

  const curM = computeMonthMetrics(
    currentOrders,
    currentCostoExpenses.reduce((s, e) => s + Number(e.amount), 0),
  );

  const totalsByMonth = new Map<string, number>();
  for (const o of historyOrders) {
    const k = monthKey(o.createdAt);
    totalsByMonth.set(k, (totalsByMonth.get(k) ?? 0) + Number(o.total));
  }

  // Compara contra el último mes anterior que tuvo ventas, no ciegamente contra el
  // mes calendario inmediatamente anterior (que puede estar vacío si la tienda es
  // nueva o si recién empezó el mes en curso).
  let comparisonKey = priorKey;
  for (let i = 1; i <= 6; i++) {
    const k = shiftMonthKey(currentKey, -i);
    if (totalsByMonth.get(k)) {
      comparisonKey = k;
      break;
    }
  }
  const comparison = monthRange(comparisonKey);
  const [comparisonOrders, comparisonCostoExpenses] = await Promise.all([
    prisma.order.findMany({
      where: { ...storeWhere, status: { not: "CANCELLED" }, createdAt: { gte: comparison.start, lt: comparison.end } },
      include: orderWithItemsInclude,
    }),
    prisma.expense.findMany({
      where: { ...storeWhere, type: "COSTO", date: { gte: comparison.start, lt: comparison.end } },
    }),
  ]);
  const prevM = computeMonthMetrics(
    comparisonOrders,
    comparisonCostoExpenses.reduce((s, e) => s + Number(e.amount), 0),
  );

  // Clientes nuevos vs recurrentes este mes.
  const customerIdsThisMonth = [...new Set(currentOrders.map((o) => o.customerId))];
  const earlierOrders = customerIdsThisMonth.length
    ? await prisma.order.findMany({
        where: {
          ...storeWhere,
          customerId: { in: customerIdsThisMonth },
          status: { not: "CANCELLED" },
          createdAt: { lt: current.start },
        },
        select: { customerId: true },
        distinct: ["customerId"],
      })
    : [];
  const earlierSet = new Set(earlierOrders.map((o) => o.customerId));
  let clientesNuevos = 0;
  let clientesRecurrentes = 0;
  for (const cid of customerIdsThisMonth) {
    if (earlierSet.has(cid)) clientesRecurrentes++;
    else clientesNuevos++;
  }

  // Clientes en scope (al menos un pedido no cancelado alguna vez) + inactivos (>60 días).
  const customerAgg = await prisma.order.groupBy({
    by: ["customerId"],
    where: { ...storeWhere, status: { not: "CANCELLED" } },
    _max: { createdAt: true },
    _count: true,
  });
  const now = new Date();
  const clientesInactivos = customerAgg.filter(
    (c) => c._max.createdAt && daysBetween(c._max.createdAt, now) > 60,
  ).length;

  const orderCountByCustomer = new Map(customerAgg.map((c) => [c.customerId, c._count]));
  const inScopeCustomerIds = customerAgg.map((c) => c.customerId);
  const topClientesRaw = inScopeCustomerIds.length
    ? await prisma.customer.findMany({
        where: { id: { in: inScopeCustomerIds } },
        orderBy: { lifetimeValue: "desc" },
        take: 5,
        select: { id: true, name: true, lifetimeValue: true },
      })
    : [];
  const topClientes = topClientesRaw.map((c) => ({
    customerId: c.id,
    name: c.name,
    lifetimeValue: Number(c.lifetimeValue),
    orderCount: orderCountByCustomer.get(c.id) ?? 0,
  }));

  // Rotación de productos del mes en curso.
  const products = await prisma.product.findMany({
    where: storeWhere,
    select: { id: true, name: true, costPrice: true },
  });
  const productStats = computeProductStats(products, currentOrders);

  const rotacionRevisar = productStats
    .filter((p) => p.qtySold > 0 && p.profitPct !== null && p.profitPct < 20)
    .sort((a, b) => (a.profitPct as number) - (b.profitPct as number))
    .slice(0, 5);

  const sinMovimiento = productStats
    .filter((p) => p.qtySold === 0)
    .slice(0, 6)
    .map((p) => ({ productId: p.productId, name: p.name }));

  // Proyección de ventas: crecimiento promedio mes a mes sobre hasta 6 meses con datos
  // (reutiliza totalsByMonth, ya calculado arriba para elegir el mes de comparación).
  const sortedKeys = [...totalsByMonth.keys()].sort();
  const totalsSeries = sortedKeys.map((k) => totalsByMonth.get(k)!);
  const growths: number[] = [];
  for (let i = 1; i < totalsSeries.length; i++) {
    const prevTotal = totalsSeries[i - 1];
    if (prevTotal > 0) growths.push((totalsSeries[i] - prevTotal) / prevTotal);
  }
  const lastSixGrowths = growths.slice(-6);
  const avgGrowth = lastSixGrowths.length ? lastSixGrowths.reduce((s, g) => s + g, 0) / lastSixGrowths.length : 0;
  const lastMonthTotal = totalsSeries.length ? totalsSeries[totalsSeries.length - 1] : 0;
  const proyeccionVentas = Math.max(0, lastMonthTotal * (1 + avgGrowth));

  // Tabla de tendencia: los 6 meses calendario más recientes (incluye el actual),
  // con cero explícito en los meses sin ventas (no se omiten, para que la tabla
  // siempre tenga 6 filas).
  const monthlyTrend = Array.from({ length: 6 }, (_, i) => {
    const key = shiftMonthKey(currentKey, -(5 - i));
    return { month: key, ventas: totalsByMonth.get(key) ?? 0 };
  });

  res.json({
    ventas: curM.ventas,
    ventasDelta: pctDelta(curM.ventas, prevM.ventas),
    pedidos: curM.pedidos,
    pedidosDelta: pctDelta(curM.pedidos, prevM.pedidos),
    ticket: curM.ticket,
    ticketDelta: pctDelta(curM.ticket, prevM.ticket),
    margen: curM.margen,
    margenDelta: pctDelta(curM.margen, prevM.margen),
    satisfaccion: curM.satisfaccion,
    satisfaccionDelta: curM.satisfaccion !== null ? pctDelta(curM.satisfaccion, prevM.satisfaccion) : null,
    comparadoConMes: comparisonKey,
    clientesNuevos,
    clientesRecurrentes,
    clientesInactivos,
    topClientes,
    rotacionRevisar,
    sinMovimiento,
    proyeccionVentas,
    monthlyTrend,
    crecimientoPromedioMensual: avgGrowth * 100,
  });
});

const LOW_STOCK = 5;
const BUDGET_OBJETIVO = 15;

/**
 * Recomendaciones (§4.6 del mockup): 5 paneles independientes, gated además por el
 * permiso "recomendaciones" (financeRouter ya exige "finanzas" para toda la ruta).
 */
financeRouter.get("/recommendations", async (req, res) => {
  const allowed = await can(req.auth!.role, "recomendaciones");
  if (!allowed) return res.status(403).json({ error: "No tienes permiso para esta acción" });

  const storeId = resolveStoreId(req);
  if (req.auth!.role !== "ADMIN" && !storeId) {
    return res.status(400).json({ error: "Falta seleccionar una tienda" });
  }
  const storeWhere = storeId ? { storeId } : {};

  const currentKey = monthKey(new Date());
  const priorKey = shiftMonthKey(currentKey, -1);
  const current = monthRange(currentKey);
  const prior = monthRange(priorKey);

  // Panel 1: Qué comprar.
  const lowStockSupplies = await prisma.supply.findMany({
    where: { ...storeWhere, stock: { lt: LOW_STOCK }, active: true },
    orderBy: { stock: "asc" },
    select: { id: true, name: true, stock: true, unit: true },
  });
  const queComprar = lowStockSupplies.map((s) => {
    const stock = Number(s.stock);
    const comprar = Math.max(Math.ceil(BUDGET_OBJETIVO - stock), BUDGET_OBJETIVO);
    return { supplyId: s.id, name: s.name, stock, unit: s.unit, objetivo: BUDGET_OBJETIVO, comprar };
  });

  const [currentOrders, priorOrders] = await Promise.all([
    prisma.order.findMany({
      where: { ...storeWhere, status: { not: "CANCELLED" }, createdAt: { gte: current.start, lt: current.end } },
      include: orderWithItemsInclude,
    }),
    prisma.order.findMany({
      where: { ...storeWhere, status: { not: "CANCELLED" }, createdAt: { gte: prior.start, lt: prior.end } },
      include: orderWithItemsInclude,
    }),
  ]);

  const products = await prisma.product.findMany({
    where: storeWhere,
    select: { id: true, name: true, costPrice: true },
  });
  const productStats = computeProductStats(products, currentOrders);

  // Panel 2: Estrategias de venta.
  const mostSold = productStats.filter((p) => p.qtySold > 0).sort((a, b) => b.qtySold - a.qtySold)[0] ?? null;
  const profitable = productStats.filter((p): p is ProductStat & { profitPct: number } => p.profitPct !== null);
  const mostProfitable = profitable.length
    ? profitable.reduce((a, b) => (b.profitPct > a.profitPct ? b : a))
    : null;
  const leastProfitableCandidate = profitable.length
    ? profitable.reduce((a, b) => (b.profitPct < a.profitPct ? b : a))
    : null;
  const leastProfitable =
    leastProfitableCandidate && leastProfitableCandidate.profitPct < 20 ? leastProfitableCandidate : null;

  const customerIdsInScope = [
    ...new Set(
      (
        await prisma.order.findMany({
          where: { ...storeWhere, status: { not: "CANCELLED" } },
          select: { customerId: true },
          distinct: ["customerId"],
        })
      ).map((o) => o.customerId),
    ),
  ];
  const customersInScope = customerIdsInScope.length
    ? await prisma.customer.findMany({
        where: { id: { in: customerIdsInScope } },
        select: { id: true, acquisitionChannel: true },
      })
    : [];
  const channelCounts = new Map<string, number>();
  for (const c of customersInScope) {
    const key = c.acquisitionChannel || "Sin canal";
    channelCounts.set(key, (channelCounts.get(key) ?? 0) + 1);
  }
  let topChannel: { channel: string; count: number } | null = null;
  for (const [channel, count] of channelCounts) {
    if (!topChannel || count > topChannel.count) topChannel = { channel, count };
  }

  // Clientes "inactivos" — heurística simplificada de §4.7: >=2 pedidos no cancelados
  // y diasDesde el último pedido >= avgInterval*1.6.
  const ordersByCustomer = customerIdsInScope.length
    ? await prisma.order.findMany({
        where: { ...storeWhere, status: { not: "CANCELLED" }, customerId: { in: customerIdsInScope } },
        select: { customerId: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      })
    : [];
  const datesByCustomer = new Map<string, Date[]>();
  for (const o of ordersByCustomer) {
    const arr = datesByCustomer.get(o.customerId) ?? [];
    arr.push(o.createdAt);
    datesByCustomer.set(o.customerId, arr);
  }
  const nowDate = new Date();
  let inactivosCount = 0;
  for (const dates of datesByCustomer.values()) {
    if (dates.length < 2) continue;
    const gaps: number[] = [];
    for (let i = 1; i < dates.length; i++) gaps.push(daysBetween(dates[i - 1], dates[i]));
    const avgInterval = gaps.reduce((s, g) => s + g, 0) / gaps.length;
    const diasDesde = daysBetween(dates[dates.length - 1], nowDate);
    if (diasDesde >= avgInterval * 1.6) inactivosCount++;
  }

  const estrategiasVenta = {
    masVendido: mostSold ? { productId: mostSold.productId, name: mostSold.name, qtySold: mostSold.qtySold } : null,
    masRentable: mostProfitable
      ? { productId: mostProfitable.productId, name: mostProfitable.name, profitPct: mostProfitable.profitPct }
      : null,
    menosRentable: leastProfitable
      ? { productId: leastProfitable.productId, name: leastProfitable.name, profitPct: leastProfitable.profitPct }
      : null,
    canalTop: topChannel,
    clientesInactivos: inactivosCount,
  };

  // Panel 3: Acciones financieras.
  const currentExpenses = await prisma.expense.findMany({
    where: { ...storeWhere, date: { gte: current.start, lt: current.end } },
  });
  const totalExpenses = currentExpenses.reduce((s, e) => s + Number(e.amount), 0);
  const byCategory = new Map<string, number>();
  for (const e of currentExpenses) {
    byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + Number(e.amount));
  }
  let topCategory: { category: string; amount: number; pct: number } | null = null;
  for (const [category, amount] of byCategory) {
    if (!topCategory || amount > topCategory.amount) {
      topCategory = { category, amount, pct: totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0 };
    }
  }
  const productosBajaRentabilidad = productStats.filter((p) => p.profitPct !== null && p.profitPct < 20).length;

  const currentVentas = currentOrders.reduce((s, o) => s + Number(o.total), 0);
  const currentCOGS = currentOrders.reduce((s, o) => s + orderCOGS(o), 0);
  const currentMargin = currentVentas > 0 ? ((currentVentas - currentCOGS) / currentVentas) * 100 : 0;
  const priorVentas = priorOrders.reduce((s, o) => s + Number(o.total), 0);
  const priorCOGS = priorOrders.reduce((s, o) => s + orderCOGS(o), 0);
  const priorMargin = priorVentas > 0 ? ((priorVentas - priorCOGS) / priorVentas) * 100 : 0;
  const margenCayo = priorVentas > 0 && currentMargin < priorMargin;

  const accionesFinancieras = {
    categoriaTop: topCategory,
    productosBajaRentabilidad,
    margenCayo,
  };

  // Panel 4: Gestión operativa.
  const domiciliariosActivos = await prisma.user.count({
    where: { ...storeWhere, active: true, position: { contains: "Domiciliario" } },
  });
  const sinDomiciliarios = domiciliariosActivos === 0;

  const pedidosSinAsignar = await prisma.order.count({
    where: {
      ...storeWhere,
      status: { in: ["READY", "OUT_FOR_DELIVERY"] },
      deliveryPersonId: null,
      isThirdPartyDelivery: false,
    },
  });

  let mejorTienda: { storeId: string; name: string; ventas: number } | null = null;
  let peorTienda: { storeId: string; name: string; ventas: number; critico: boolean } | null = null;
  let tiendaMenosSatisfecha: { storeId: string; name: string; satisfaccion: number } | null = null;

  if (!storeId) {
    const [allOrders, stores] = await Promise.all([
      prisma.order.findMany({
        where: { status: { not: "CANCELLED" }, createdAt: { gte: current.start, lt: current.end } },
        select: { storeId: true, total: true, rating: true },
      }),
      prisma.store.findMany({ select: { id: true, name: true } }),
    ]);
    const salesByStore = new Map<string, number>();
    const ratingSumByStore = new Map<string, number>();
    const ratingCountByStore = new Map<string, number>();
    for (const o of allOrders) {
      salesByStore.set(o.storeId, (salesByStore.get(o.storeId) ?? 0) + Number(o.total));
      if (o.rating !== null) {
        ratingSumByStore.set(o.storeId, (ratingSumByStore.get(o.storeId) ?? 0) + o.rating);
        ratingCountByStore.set(o.storeId, (ratingCountByStore.get(o.storeId) ?? 0) + 1);
      }
    }
    const storeName = (id: string) => stores.find((s) => s.id === id)?.name ?? id;
    const salesEntries = [...salesByStore.entries()];
    if (salesEntries.length) {
      const [leaderId, leaderSales] = salesEntries.reduce((a, b) => (b[1] > a[1] ? b : a));
      mejorTienda = { storeId: leaderId, name: storeName(leaderId), ventas: leaderSales };
      const [worstId, worstSales] = salesEntries.reduce((a, b) => (b[1] < a[1] ? b : a));
      peorTienda = {
        storeId: worstId,
        name: storeName(worstId),
        ventas: worstSales,
        critico: leaderSales > 0 && worstSales < leaderSales * 0.5,
      };
    }
    let worstSat: { storeId: string; avg: number } | null = null;
    for (const [sid, sum] of ratingSumByStore) {
      const count = ratingCountByStore.get(sid) ?? 0;
      if (!count) continue;
      const avg = sum / count;
      if (!worstSat || avg < worstSat.avg) worstSat = { storeId: sid, avg };
    }
    if (worstSat && worstSat.avg < 4) {
      tiendaMenosSatisfecha = { storeId: worstSat.storeId, name: storeName(worstSat.storeId), satisfaccion: worstSat.avg };
    }
  }

  const gestionOperativa = {
    sinDomiciliarios,
    pedidosSinAsignar,
    mejorTienda,
    peorTienda,
    tiendaMenosSatisfecha,
  };

  // Panel 5: Resumen del presupuesto del mes en curso (§4.5, reutilizado).
  const budgetEntries = await prisma.budgetEntry.findMany({ where: { ...storeWhere, month: currentKey } });
  const revenueByProductName = new Map<string, number>();
  for (const order of currentOrders) {
    for (const item of order.items) {
      revenueByProductName.set(
        item.productName,
        (revenueByProductName.get(item.productName) ?? 0) + Number(item.subtotal),
      );
    }
  }
  let cumplidos = 0;
  let enRiesgo = 0;
  for (const entry of budgetEntries) {
    const presupuesto = Number(entry.amount);
    const real = revenueByProductName.get(entry.productName) ?? 0;
    const cumplimiento = presupuesto > 0 ? (real / presupuesto) * 100 : real > 0 ? 100 : null;
    if (cumplimiento === null) continue;
    if (cumplimiento >= 100) cumplidos++;
    else if (cumplimiento < 70) enRiesgo++;
  }
  const resumenPresupuesto = { cumplidos, enRiesgo, total: budgetEntries.length };

  res.json({ queComprar, estrategiasVenta, accionesFinancieras, gestionOperativa, resumenPresupuesto });
});
