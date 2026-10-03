import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, FinanceEvolutionPoint, FinanceSummary, Order } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { money } from "../../lib/labels";
import { BarChart, GroupedBarChart } from "./charts";

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}
function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}
const MONTH_NAMES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
function monthLabel(key: string) {
  const [, m] = key.split("-").map(Number);
  return MONTH_NAMES[m - 1];
}

interface Props {
  storeId?: string;
  onGoToFacturas: () => void;
}

export default function DashboardTab({ storeId, onGoToFacturas }: Props) {
  const { can } = useAuth();
  const navigate = useNavigate();
  const today = new Date();
  const [from, setFrom] = useState(isoDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29)));
  const [to, setTo] = useState(isoDate(today));
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [expenses, setExpenses] = useState<Array<{ category: string; amount: string; date: string; type: string }>>([]);
  const [evolution, setEvolution] = useState<FinanceEvolutionPoint[]>([]);
  const [granularity, setGranularity] = useState<"dia" | "mes">("dia");
  const [trendYear, setTrendYear] = useState(today.getFullYear());

  function preset(days: number) {
    setFrom(isoDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() - (days - 1))));
    setTo(isoDate(today));
  }
  function presetThisMonth() {
    setFrom(isoDate(startOfMonth(today)));
    setTo(isoDate(today));
  }
  function presetLastMonth() {
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    setFrom(isoDate(startOfMonth(lastMonth)));
    setTo(isoDate(endOfMonth(lastMonth)));
  }

  useEffect(() => {
    const fromIso = new Date(from + "T00:00:00").toISOString();
    const toIso = new Date(to + "T23:59:59").toISOString();
    api.get<FinanceSummary>("/finance/summary", { params: { storeId, from: fromIso, to: toIso } }).then((r) => setSummary(r.data));
    api.get<Order[]>("/orders", { params: { storeId } }).then((r) => setOrders(r.data));
    api.get("/expenses", { params: { storeId, from: fromIso, to: toIso } }).then((r) => setExpenses(r.data));
    api.get<FinanceEvolutionPoint[]>("/finance/evolution", { params: { storeId } }).then((r) => setEvolution(r.data));
  }, [storeId, from, to]);

  const ordersInRange = useMemo(
    () => orders.filter((o) => o.status !== "CANCELLED" && o.createdAt >= from && o.createdAt <= to + "T23:59:59"),
    [orders, from, to]
  );

  const ordersThisYear = useMemo(
    () => orders.filter((o) => o.status !== "CANCELLED" && new Date(o.createdAt).getFullYear() === trendYear),
    [orders, trendYear]
  );

  const availableYears = useMemo(() => {
    const years = new Set(orders.map((o) => new Date(o.createdAt).getFullYear()));
    years.add(today.getFullYear());
    return Array.from(years).sort((a, b) => b - a);
  }, [orders]);

  const trend = useMemo(() => {
    if (granularity === "dia") {
      const byDay = new Map<string, number>();
      ordersInRange.forEach((o) => {
        const day = o.createdAt.slice(5, 10);
        byDay.set(day, (byDay.get(day) ?? 0) + Number(o.total));
      });
      return Array.from(byDay.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-14)
        .map(([label, value]) => ({ label, value }));
    }
    const byMonth = new Map<number, number>();
    ordersThisYear.forEach((o) => {
      const m = new Date(o.createdAt).getMonth();
      byMonth.set(m, (byMonth.get(m) ?? 0) + Number(o.total));
    });
    return Array.from({ length: 12 }, (_, m) => ({ label: MONTH_NAMES[m], value: byMonth.get(m) ?? 0 }));
  }, [granularity, ordersInRange, ordersThisYear]);

  const categoryVentas = useMemo(() => {
    const byCat = new Map<string, number>();
    ordersInRange.forEach((o) => o.items.forEach((it) => byCat.set(it.product.category, (byCat.get(it.product.category) ?? 0) + Number(it.subtotal))));
    return Array.from(byCat.entries()).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 6);
  }, [ordersInRange]);

  const categoryGastos = useMemo(() => {
    const byCat = new Map<string, number>();
    expenses.forEach((e) => byCat.set(e.category, (byCat.get(e.category) ?? 0) + Number(e.amount)));
    return Array.from(byCat.entries()).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 6);
  }, [expenses]);

  const productStats = useMemo(() => {
    const byProduct = new Map<string, { name: string; qty: number; revenue: number; cost: number; hasCost: boolean }>();
    ordersInRange.forEach((o) =>
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
  }, [ordersInRange]);

  const topVendidos = [...productStats].sort((a, b) => b.qty - a.qty).slice(0, 5);
  const topRentables = [...productStats].filter((p) => p.profitPct != null).sort((a, b) => b.profitPct! - a.profitPct!).slice(0, 5);
  const menosRentables = [...productStats].filter((p) => p.profitPct != null).sort((a, b) => a.profitPct! - b.profitPct!).slice(0, 5);

  const evolutionChartData = evolution.map((e) => ({
    label: monthLabel(e.month),
    series: { Ventas: e.ventas, Costos: e.costos, Gastos: e.gastos, Inversiones: e.inversiones, Utilidad: e.utilidad },
  }));

  const byStoreChartData = (summary?.byStore ?? []).map((s) => ({
    label: s.name.slice(0, 12),
    series: { Ventas: s.ventas, Costos: s.costos, Gastos: s.gastos, Inversiones: s.inversiones },
  }));
  const ventasPorTienda = (summary?.byStore ?? []).map((s) => ({ label: s.name.slice(0, 12), value: s.ventas })).sort((a, b) => b.value - a.value);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Desde</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="border rounded-md px-2 py-1 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Hasta</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="border rounded-md px-2 py-1 text-sm" />
        </div>
        <button type="button" onClick={() => preset(7)} className="text-xs border rounded-md px-2 py-1.5">7 días</button>
        <button type="button" onClick={() => preset(30)} className="text-xs border rounded-md px-2 py-1.5">30 días</button>
        <button type="button" onClick={presetThisMonth} className="text-xs border rounded-md px-2 py-1.5">Este mes</button>
        <button type="button" onClick={presetLastMonth} className="text-xs border rounded-md px-2 py-1.5">Mes pasado</button>
      </div>

      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: "Ventas", value: summary.ventas, color: "text-green-700", onClick: () => navigate("/pedidos") },
            { label: "Costos", value: summary.costos, color: "text-red-700", onClick: onGoToFacturas },
            { label: "Gastos", value: summary.gastos, color: "text-amber-700", onClick: onGoToFacturas },
            { label: "Inversiones", value: summary.inversiones, color: "text-blue-700", onClick: onGoToFacturas },
            { label: "EBITDA", value: summary.ebitda, color: summary.ebitda >= 0 ? "text-blue-700" : "text-red-700", onClick: undefined },
          ].map((c) => (
            <button
              key={c.label}
              type="button"
              onClick={c.onClick}
              disabled={!c.onClick}
              title={c.onClick ? "Ver detalle" : undefined}
              className={`bg-white border rounded-lg p-3 text-left ${c.onClick ? "hover:border-pink-300 hover:shadow-sm cursor-pointer" : "cursor-default"}`}
            >
              <div className="text-xs uppercase text-gray-500">{c.label}</div>
              <div className={`text-lg font-bold ${c.color}`}>{money(c.value)}</div>
              {c.label === "EBITDA" && <div className="text-xs text-gray-500">{summary.ebitdaPct.toFixed(1)}% de las ventas</div>}
            </button>
          ))}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
            <h3 className="text-sm font-medium">Tendencia de ventas</h3>
            <div className="flex items-center gap-1 text-xs">
              <select value={granularity} onChange={(e) => setGranularity(e.target.value as "dia" | "mes")} className="border rounded-md px-1.5 py-1">
                <option value="dia">Día a día</option>
                <option value="mes">Mes a mes</option>
              </select>
              {granularity === "mes" && (
                <select value={trendYear} onChange={(e) => setTrendYear(Number(e.target.value))} className="border rounded-md px-1.5 py-1">
                  {availableYears.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              )}
            </div>
          </div>
          {trend.length > 0 ? <BarChart data={trend} /> : <p className="text-xs text-gray-400">Sin datos en el rango.</p>}
        </div>
        <div className="bg-white border rounded-lg p-4">
          <h3 className="text-sm font-medium mb-2">Ventas / Costos / Gastos / Inversiones / Utilidad (últimos 6 meses)</h3>
          {evolutionChartData.length > 0 ? (
            <GroupedBarChart data={evolutionChartData} seriesKeys={["Ventas", "Costos", "Gastos", "Inversiones", "Utilidad"]} interactive />
          ) : (
            <p className="text-xs text-gray-400">Sin datos.</p>
          )}
        </div>
        <div className="bg-white border rounded-lg p-4">
          <h3 className="text-sm font-medium mb-2">Ventas por categoría</h3>
          {categoryVentas.length > 0 ? <BarChart data={categoryVentas} color="#3b82f6" /> : <p className="text-xs text-gray-400">Sin datos.</p>}
        </div>
        <div className="bg-white border rounded-lg p-4">
          <h3 className="text-sm font-medium mb-2">Gastos por categoría</h3>
          {categoryGastos.length > 0 ? <BarChart data={categoryGastos} color="#f59e0b" /> : <p className="text-xs text-gray-400">Sin datos.</p>}
        </div>

        {!storeId && summary?.byStore && summary.byStore.length > 0 && (
          <>
            <div className="bg-white border rounded-lg p-4">
              <h3 className="text-sm font-medium mb-2">Comparativo de gestión por tienda</h3>
              <GroupedBarChart data={byStoreChartData} seriesKeys={["Ventas", "Costos", "Gastos", "Inversiones"]} interactive />
            </div>
            <div className="bg-white border rounded-lg p-4">
              <h3 className="text-sm font-medium mb-2">Ventas por tienda</h3>
              <BarChart data={ventasPorTienda} color="#10b981" />
            </div>
          </>
        )}
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
