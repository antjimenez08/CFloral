import { useEffect, useMemo, useState } from "react";
import { api, Expense, FinanceEvolutionPoint, FinanceSummary, Order } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { money } from "../../lib/labels";
import { BarChart, GroupedBarChart } from "./charts";

// Igual que EBITDA_EXCLUDED_CATEGORIES en server/src/routes/finance.routes.ts: categorías que
// restan a la utilidad neta pero se suman de vuelta para el EBITDA.
const EBITDA_EXCLUDED_CATEGORIES = ["Depreciación", "Intereses financieros", "Impuestos"];
const MONTH_SHORT = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const MONTH_FULL = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

function monthKeyOf(iso: string) {
  return iso.slice(0, 7);
}
function monthShortLabel(key: string) {
  const m = Number(key.split("-")[1]);
  return MONTH_SHORT[m - 1];
}
function monthFullLabel(key: string) {
  const [y, m] = key.split("-");
  return `${MONTH_FULL[Number(m) - 1]} ${y}`;
}
function orderCOGS(o: Order): number {
  return o.items.reduce((s, it) => s + Number(it.product.costPrice ?? 0) * it.quantity, 0);
}
function computeMetrics(orders: Order[], expenses: Expense[]) {
  const ventas = orders.reduce((s, o) => s + Number(o.total), 0);
  const costos = orders.reduce((s, o) => s + orderCOGS(o), 0);
  const gastos = expenses.filter((e) => e.type === "GASTO" || e.type === "OTRO").reduce((s, e) => s + Number(e.amount), 0);
  const costosRegistrados = expenses.filter((e) => e.type === "COSTO").reduce((s, e) => s + Number(e.amount), 0);
  const inversiones = expenses.filter((e) => e.type === "INVERSION").reduce((s, e) => s + Number(e.amount), 0);
  const costosTotal = costos + costosRegistrados;
  const noOperativos = expenses
    .filter((e) => e.type !== "INVERSION" && EBITDA_EXCLUDED_CATEGORIES.includes(e.category))
    .reduce((s, e) => s + Number(e.amount), 0);
  const ebitda = ventas - costosTotal - gastos + noOperativos;
  return { ventas, costos: costosTotal, gastos, inversiones, ebitda, ebitdaPct: ventas > 0 ? (ebitda / ventas) * 100 : 0 };
}

type Granularity = "mes" | "dia";
type DrillKey = "ventas" | "costos" | "gastos" | "inversiones" | null;

interface Props {
  storeId?: string;
}

export default function DashboardTab({ storeId }: Props) {
  const { can } = useAuth();

  const [orders, setOrders] = useState<Order[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [evolution, setEvolution] = useState<FinanceEvolutionPoint[]>([]);

  const [granularity, setGranularity] = useState<Granularity>("mes");
  const [days, setDays] = useState(7);
  const [year, setYear] = useState("");
  const [monthFilter, setMonthFilter] = useState<Set<string> | null>(null); // null = todos los meses
  const [monthDropdownOpen, setMonthDropdownOpen] = useState(false);
  const [drilldown, setDrilldown] = useState<DrillKey>(null);

  useEffect(() => {
    api.get<Order[]>("/orders", { params: { storeId } }).then((r) => setOrders(r.data));
    api.get<Expense[]>("/expenses", { params: { storeId } }).then((r) => setExpenses(r.data));
    setDrilldown(null);
  }, [storeId]);

  const allMonthKeys = useMemo(() => {
    const set = new Set<string>();
    orders.forEach((o) => {
      if (o.status !== "CANCELLED") set.add(monthKeyOf(o.createdAt));
    });
    expenses.forEach((e) => set.add(monthKeyOf(e.date)));
    return Array.from(set).sort();
  }, [orders, expenses]);

  const allYears = useMemo(() => {
    const set = new Set(allMonthKeys.map((k) => k.split("-")[0]));
    set.add(String(new Date().getFullYear()));
    return Array.from(set).sort().reverse();
  }, [allMonthKeys]);

  function isMonthSelected(key: string) {
    if (year && key.split("-")[0] !== year) return false;
    return monthFilter === null || monthFilter.has(key);
  }
  const monthKeysInScope = useMemo(
    () => (year ? allMonthKeys.filter((k) => k.split("-")[0] === year) : allMonthKeys),
    [allMonthKeys, year]
  );
  const selectedMonthKeys = useMemo(
    () => monthKeysInScope.filter(isMonthSelected),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [monthKeysInScope, monthFilter, year]
  );

  function finInScope(iso: string): boolean {
    if (granularity === "dia") {
      const d = new Date(iso);
      d.setHours(0, 0, 0, 0);
      const end = new Date();
      end.setHours(0, 0, 0, 0);
      const start = new Date(end);
      start.setDate(start.getDate() - (days - 1));
      return d >= start && d <= end;
    }
    return isMonthSelected(monthKeyOf(iso));
  }

  const ordersInScope = useMemo(
    () => orders.filter((o) => o.status !== "CANCELLED" && finInScope(o.createdAt)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [orders, granularity, days, monthFilter, year]
  );
  const expensesInScope = useMemo(
    () => expenses.filter((e) => finInScope(e.date)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [expenses, granularity, days, monthFilter, year]
  );

  const metrics = useMemo(() => computeMetrics(ordersInScope, expensesInScope), [ordersInScope, expensesInScope]);

  const selectedMonthsKey = selectedMonthKeys.join(",");
  useEffect(() => {
    const params: Record<string, unknown> = { storeId };
    if (granularity === "dia") params.days = days;
    else params.months = selectedMonthsKey;
    api.get<FinanceSummary>("/finance/summary", { params }).then((r) => setSummary(r.data));
    api.get<FinanceEvolutionPoint[]>("/finance/evolution", { params }).then((r) => setEvolution(r.data));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, granularity, days, selectedMonthsKey]);

  const storeNameById = useMemo(() => {
    const map = new Map<string, string>();
    (summary?.byStore ?? []).forEach((s) => map.set(s.storeId, s.name));
    return map;
  }, [summary]);

  function toggleMonth(key: string) {
    setMonthFilter((prev) => {
      const base = prev ?? new Set(monthKeysInScope);
      const next = new Set(base);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const trendItems = evolution.map((e) => ({
    label: granularity === "mes" ? monthShortLabel(e.month) : e.month.slice(5),
    value: e.ventas,
  }));
  const evolutionChartData = evolution.map((e) => ({
    label: granularity === "mes" ? monthShortLabel(e.month) : e.month.slice(5),
    series: { Ventas: e.ventas, Costos: e.costos, Gastos: e.gastos, Inversiones: e.inversiones, Utilidad: e.utilidad },
  }));

  const categoryVentas = useMemo(() => {
    const byCat = new Map<string, number>();
    ordersInScope.forEach((o) => o.items.forEach((it) => byCat.set(it.product.category, (byCat.get(it.product.category) ?? 0) + Number(it.subtotal))));
    return Array.from(byCat.entries()).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 6);
  }, [ordersInScope]);

  const categoryGastos = useMemo(() => {
    const byCat = new Map<string, number>();
    expensesInScope.filter((e) => e.type === "GASTO" || e.type === "OTRO").forEach((e) => byCat.set(e.category, (byCat.get(e.category) ?? 0) + Number(e.amount)));
    return Array.from(byCat.entries()).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 6);
  }, [expensesInScope]);

  const productStats = useMemo(() => {
    const byProduct = new Map<string, { name: string; qty: number; revenue: number; cost: number; hasCost: boolean }>();
    ordersInScope.forEach((o) =>
      o.items.forEach((it) => {
        const key = it.productId;
        const row = byProduct.get(key) ?? { name: it.productName, qty: 0, revenue: 0, cost: 0, hasCost: false };
        row.qty += it.quantity;
        row.revenue += Number(it.subtotal);
        if (it.product.costPrice != null) {
          row.cost += Number(it.product.costPrice) * it.quantity;
          row.hasCost = true;
        }
        byProduct.set(key, row);
      })
    );
    return Array.from(byProduct.values()).map((r) => ({
      ...r,
      profit: r.revenue - r.cost,
      profitPct: r.hasCost && r.revenue > 0 ? ((r.revenue - r.cost) / r.revenue) * 100 : null,
    }));
  }, [ordersInScope]);

  const topVendidos = [...productStats].sort((a, b) => b.qty - a.qty).slice(0, 5);
  const topRentables = [...productStats].filter((p) => p.profitPct != null).sort((a, b) => b.profitPct! - a.profitPct!).slice(0, 5);
  const menosRentables = [...productStats].filter((p) => p.profitPct != null).sort((a, b) => a.profitPct! - b.profitPct!).slice(0, 5);

  const byStoreChartData = (summary?.byStore ?? []).map((s) => ({
    label: s.name.replace("Floral ", ""),
    series: { Ventas: s.ventas, Costos: s.costos, Gastos: s.gastos, Inversiones: s.inversiones, Utilidad: s.ebitda },
  }));
  const ventasPorTienda = (summary?.byStore ?? []).map((s) => ({
    label: s.name.replace("Floral ", ""),
    value: s.ventas,
    color: !storeId || storeId === s.storeId ? "#db2777" : "#d1d5db",
  }));

  function drilldownRows(): { headers: string[]; rows: Array<string[]> } {
    if (drilldown === "ventas") {
      const rows = [...ordersInScope]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((o) => [
          o.invoiceNumber,
          new Date(o.createdAt).toLocaleDateString("es-CO"),
          storeNameById.get(o.storeId) ?? "—",
          o.recipientName || o.customer.name,
          money(o.total),
        ]);
      return { headers: ["Pedido", "Fecha", "Tienda", "Cliente", "Valor"], rows };
    }
    if (drilldown === "costos") {
      const ventaRows = ordersInScope
        .filter((o) => orderCOGS(o) > 0)
        .map((o) => [
          "Costo de venta",
          new Date(o.createdAt).toLocaleDateString("es-CO"),
          `${o.invoiceNumber} — ${o.items.map((it) => `${it.quantity}x ${it.productName}`).join(", ")}`,
          storeNameById.get(o.storeId) ?? "—",
          money(orderCOGS(o)),
        ]);
      const facturaRows = expensesInScope
        .filter((e) => e.type === "COSTO")
        .map((e) => [
          "Factura",
          new Date(e.date).toLocaleDateString("es-CO"),
          e.category + (e.description ? ` — ${e.description}` : ""),
          storeNameById.get(e.storeId) ?? "—",
          money(e.amount),
        ]);
      return { headers: ["Origen", "Fecha", "Detalle", "Tienda", "Valor"], rows: [...ventaRows, ...facturaRows] };
    }
    if (drilldown === "gastos" || drilldown === "inversiones") {
      const type = drilldown === "gastos" ? ["GASTO", "OTRO"] : ["INVERSION"];
      const rows = expensesInScope
        .filter((e) => type.includes(e.type))
        .sort((a, b) => b.date.localeCompare(a.date))
        .map((e) => [
          new Date(e.date).toLocaleDateString("es-CO"),
          e.category,
          e.description || "—",
          storeNameById.get(e.storeId) ?? "—",
          money(e.amount),
        ]);
      return { headers: ["Fecha", "Categoría", "Descripción", "Tienda", "Valor"], rows };
    }
    return { headers: [], rows: [] };
  }
  const drillTitle: Record<Exclude<DrillKey, null>, string> = {
    ventas: "Detalle de Ventas",
    costos: "Detalle de Costos",
    gastos: "Detalle de Gastos",
    inversiones: "Detalle de Inversiones",
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-gray-500">Ver por:</span>
        <button type="button" onClick={() => setGranularity("mes")} className={`text-xs rounded-md px-3 py-1.5 ${granularity === "mes" ? "bg-pink-600 text-white" : "border"}`}>Mes a mes</button>
        <button type="button" onClick={() => setGranularity("dia")} className={`text-xs rounded-md px-3 py-1.5 ${granularity === "dia" ? "bg-pink-600 text-white" : "border"}`}>Día a día</button>
        {granularity === "dia" && (
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="border rounded-md px-2 py-1.5 text-xs">
            <option value={7}>Últimos 7 días</option>
            <option value={14}>Últimos 14 días</option>
            <option value={30}>Últimos 30 días</option>
          </select>
        )}
      </div>

      {granularity === "mes" && (
        <div className="flex flex-wrap items-center gap-2">
          <select value={year} onChange={(e) => setYear(e.target.value)} className="border rounded-md px-2 py-1.5 text-xs">
            <option value="">Todos los años</option>
            {allYears.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <div className="relative">
            <button type="button" onClick={() => setMonthDropdownOpen((v) => !v)} className="border rounded-md px-2 py-1.5 text-xs">
              {monthFilter === null || selectedMonthKeys.length === monthKeysInScope.length
                ? "Todos los meses"
                : selectedMonthKeys.length === 0
                ? "Sin meses"
                : selectedMonthKeys.length === 1
                ? monthFullLabel(selectedMonthKeys[0])
                : `${selectedMonthKeys.length} meses seleccionados`}
              {" "}▾
            </button>
            {monthDropdownOpen && (
              <div className="absolute z-20 mt-1 bg-white border rounded-lg shadow p-2 min-w-[200px] max-h-[220px] overflow-auto">
                {monthKeysInScope.map((key) => (
                  <label key={key} className="flex items-center gap-2 text-xs py-1 cursor-pointer">
                    <input type="checkbox" checked={isMonthSelected(key)} onChange={() => toggleMonth(key)} />
                    {monthFullLabel(key)}
                  </label>
                ))}
                <div className="flex gap-2 mt-2">
                  <button type="button" onClick={() => setMonthFilter(null)} className="flex-1 border rounded-md text-xs py-1">Todos</button>
                  <button type="button" onClick={() => setMonthFilter(new Set())} className="flex-1 border rounded-md text-xs py-1">Ninguno</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: "Ventas", value: metrics.ventas, color: "text-green-700", drill: "ventas" as DrillKey },
            { label: "Costos", value: metrics.costos, color: "text-red-700", drill: "costos" as DrillKey },
            { label: "Gastos", value: metrics.gastos, color: "text-amber-700", drill: "gastos" as DrillKey },
            { label: "Inversiones", value: metrics.inversiones, color: "text-blue-700", drill: "inversiones" as DrillKey },
            { label: "EBITDA", value: metrics.ebitda, color: metrics.ebitda >= 0 ? "text-blue-700" : "text-red-700", drill: null },
          ].map((c) => (
            <button
              key={c.label}
              type="button"
              onClick={() => c.drill && setDrilldown((prev) => (prev === c.drill ? null : c.drill))}
              disabled={!c.drill}
              title={c.drill ? "Ver detalle" : undefined}
              className={`bg-white border rounded-lg p-3 text-left ${c.drill ? "hover:border-pink-300 hover:shadow-sm cursor-pointer" : "cursor-default"} ${drilldown === c.drill ? "ring-2 ring-pink-300" : ""}`}
            >
              <div className="text-xs uppercase text-gray-500">{c.label}</div>
              <div className={`text-lg font-bold ${c.color}`}>{money(c.value)}</div>
              {c.label === "EBITDA" && <div className="text-xs text-gray-500">{metrics.ebitdaPct.toFixed(1)}% de las ventas</div>}
            </button>
          ))}
        </div>
      )}

      {drilldown && (
        <div className="bg-white border rounded-lg overflow-hidden">
          <div className="flex items-center justify-between p-3 border-b">
            <h3 className="text-sm font-medium">{drillTitle[drilldown]}</h3>
            <button type="button" onClick={() => setDrilldown(null)} className="text-xs border rounded-md px-2 py-1">Cerrar</button>
          </div>
          {(() => {
            const { headers, rows } = drilldownRows();
            if (rows.length === 0) return <p className="p-4 text-sm text-gray-400">Sin registros en este alcance.</p>;
            return (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-left text-xs text-gray-500">
                    <tr>{headers.map((h, i) => <th key={i} className={`px-3 py-2 ${i === headers.length - 1 ? "text-right" : ""}`}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {rows.map((row, ri) => (
                      <tr key={ri} className="border-t">
                        {row.map((cell, ci) => <td key={ci} className={`px-3 py-2 ${ci === row.length - 1 ? "text-right" : ""}`}>{cell}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white border rounded-lg p-4">
          <h3 className="text-sm font-medium mb-2">Tendencia de ventas</h3>
          {trendItems.length > 0 ? <BarChart data={trendItems} /> : <p className="text-xs text-gray-400">Selecciona al menos un mes para ver la tendencia.</p>}
        </div>
        <div className="bg-white border rounded-lg p-4">
          <h3 className="text-sm font-medium mb-2">{granularity === "dia" ? "Evolución diaria" : "Evolución mensual"}</h3>
          <p className="text-xs text-gray-400 mb-2">Ventas, costos, gastos, inversiones y utilidad. Haz clic en la leyenda para mostrar u ocultar cada una.</p>
          {evolutionChartData.length > 0 ? (
            <GroupedBarChart data={evolutionChartData} seriesKeys={["Ventas", "Costos", "Gastos", "Inversiones", "Utilidad"]} interactive />
          ) : (
            <p className="text-xs text-gray-400">Selecciona al menos un mes para ver la evolución.</p>
          )}
        </div>

        <div className="bg-white border rounded-lg p-4">
          <h3 className="text-sm font-medium mb-2">Comparativo de gestión por tienda</h3>
          {byStoreChartData.length > 0 ? (
            <GroupedBarChart data={byStoreChartData} seriesKeys={["Ventas", "Costos", "Gastos", "Inversiones", "Utilidad"]} interactive />
          ) : (
            <p className="text-xs text-gray-400">Sin datos.</p>
          )}
        </div>
        <div className="bg-white border rounded-lg p-4">
          <h3 className="text-sm font-medium mb-2">Ventas por tienda</h3>
          {ventasPorTienda.length > 0 ? <BarChart data={ventasPorTienda} color="#db2777" /> : <p className="text-xs text-gray-400">Sin datos.</p>}
        </div>

        <div className="bg-white border rounded-lg p-4">
          <h3 className="text-sm font-medium mb-2">Ventas por categoría</h3>
          {categoryVentas.length > 0 ? <BarChart data={categoryVentas} color="#3b82f6" /> : <p className="text-xs text-gray-400">Sin datos.</p>}
        </div>
        <div className="bg-white border rounded-lg p-4">
          <h3 className="text-sm font-medium mb-2">Gastos por categoría</h3>
          {categoryGastos.length > 0 ? <BarChart data={categoryGastos} color="#f59e0b" /> : <p className="text-xs text-gray-400">Sin gastos registrados en este alcance.</p>}
        </div>
      </div>

      {can("inventarioCosto") && (
        <div className="bg-white border rounded-lg p-4">
          <h3 className="font-medium text-sm mb-3">Desempeño de productos</h3>
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <ProductRankList title="Más vendidos" items={topVendidos.map((p) => ({ name: p.name, value: p.qty, display: `${p.qty} u.` }))} color="#3b82f6" />
            <ProductRankList title="Más rentables" items={topRentables.map((p) => ({ name: p.name, value: p.profitPct!, display: `${p.profitPct!.toFixed(0)}%` }))} color="#10b981" />
            <ProductRankList title="Menos rentables" items={menosRentables.map((p) => ({ name: p.name, value: Math.max(0, 100 - p.profitPct!), display: `${p.profitPct!.toFixed(0)}%` }))} color="#ef4444" />
          </div>
          {productStats.length === 0 && <p className="text-gray-400 text-xs mt-2">Sin ventas en el rango.</p>}
        </div>
      )}
    </div>
  );
}

function ProductRankList({ title, items, color }: { title: string; items: Array<{ name: string; value: number; display: string }>; color: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div>
      <h4 className="font-medium text-xs text-gray-500 uppercase mb-2">{title}</h4>
      {items.length === 0 && <p className="text-gray-400 text-xs">Sin datos.</p>}
      <ul className="space-y-1.5">
        {items.map((it, i) => (
          <li key={i}>
            <div className="flex justify-between text-xs mb-0.5">
              <span className="truncate pr-2">{it.name}</span>
              <span className="text-gray-500 shrink-0">{it.display}</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${(it.value / max) * 100}%`, background: color }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
