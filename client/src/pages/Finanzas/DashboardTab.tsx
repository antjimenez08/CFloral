import { useEffect, useMemo, useState } from "react";
import { api, FinanceSummary, Order } from "../../api/client";
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

export default function DashboardTab() {
  const { currentStoreId, can } = useAuth();
  const today = new Date();
  const [from, setFrom] = useState(isoDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29)));
  const [to, setTo] = useState(isoDate(today));
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [expenses, setExpenses] = useState<Array<{ category: string; amount: string; date: string; type: string }>>([]);

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
    if (!currentStoreId) return;
    const fromIso = new Date(from + "T00:00:00").toISOString();
    const toIso = new Date(to + "T23:59:59").toISOString();
    api.get<FinanceSummary>("/finance/summary", { params: { storeId: currentStoreId, from: fromIso, to: toIso } }).then((r) => setSummary(r.data));
    api.get<Order[]>("/orders", { params: { storeId: currentStoreId } }).then((r) => setOrders(r.data));
    api.get("/expenses", { params: { storeId: currentStoreId, from: fromIso, to: toIso } }).then((r) => setExpenses(r.data));
  }, [currentStoreId, from, to]);

  const ordersInRange = useMemo(
    () => orders.filter((o) => o.status !== "CANCELLED" && o.createdAt >= from && o.createdAt <= to + "T23:59:59"),
    [orders, from, to]
  );

  const dailyTrend = useMemo(() => {
    const byDay = new Map<string, number>();
    ordersInRange.forEach((o) => {
      const day = o.createdAt.slice(5, 10);
      byDay.set(day, (byDay.get(day) ?? 0) + Number(o.total));
    });
    return Array.from(byDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-14)
      .map(([label, value]) => ({ label, value }));
  }, [ordersInRange]);

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

  const masVendido = [...productStats].sort((a, b) => b.qty - a.qty)[0];
  const masRentable = [...productStats].filter((p) => p.profitPct != null).sort((a, b) => (b.profitPct! - a.profitPct!))[0];
  const menosRentable = [...productStats].filter((p) => p.profitPct != null && p.profitPct < 20).sort((a, b) => a.profitPct! - b.profitPct!)[0];

  const evolution = [
    {
      label: "Periodo",
      series: {
        Ventas: summary?.ventas ?? 0,
        Costos: summary?.costos ?? 0,
        Gastos: summary?.gastos ?? 0,
        Inversiones: summary?.inversiones ?? 0,
      },
    },
  ];

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
            { label: "Ventas", value: summary.ventas, color: "text-green-700" },
            { label: "Costos", value: summary.costos, color: "text-red-700" },
            { label: "Gastos", value: summary.gastos, color: "text-amber-700" },
            { label: "Inversiones", value: summary.inversiones, color: "text-blue-700" },
            { label: "EBITDA", value: summary.ebitda, color: summary.ebitda >= 0 ? "text-blue-700" : "text-red-700" },
          ].map((c) => (
            <div key={c.label} className="bg-white border rounded-lg p-3">
              <div className="text-xs uppercase text-gray-500">{c.label}</div>
              <div className={`text-lg font-bold ${c.color}`}>{money(c.value)}</div>
              {c.label === "EBITDA" && <div className="text-xs text-gray-500">{summary.ebitdaPct.toFixed(1)}% de las ventas</div>}
            </div>
          ))}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white border rounded-lg p-4">
          <h3 className="text-sm font-medium mb-2">Tendencia de ventas</h3>
          {dailyTrend.length > 0 ? <BarChart data={dailyTrend} /> : <p className="text-xs text-gray-400">Sin datos en el rango.</p>}
        </div>
        <div className="bg-white border rounded-lg p-4">
          <h3 className="text-sm font-medium mb-2">Ventas / Costos / Gastos / Inversiones</h3>
          <GroupedBarChart data={evolution} seriesKeys={["Ventas", "Costos", "Gastos", "Inversiones"]} />
        </div>
        <div className="bg-white border rounded-lg p-4">
          <h3 className="text-sm font-medium mb-2">Ventas por categoría</h3>
          {categoryVentas.length > 0 ? <BarChart data={categoryVentas} color="#3b82f6" /> : <p className="text-xs text-gray-400">Sin datos.</p>}
        </div>
        <div className="bg-white border rounded-lg p-4">
          <h3 className="text-sm font-medium mb-2">Gastos por categoría</h3>
          {categoryGastos.length > 0 ? <BarChart data={categoryGastos} color="#f59e0b" /> : <p className="text-xs text-gray-400">Sin datos.</p>}
        </div>
      </div>

      {can("inventarioCosto") && (
        <div className="bg-white border rounded-lg p-4 text-sm space-y-1">
          <h3 className="font-medium mb-2">Productos</h3>
          {masVendido && <p>Más vendido: <strong>{masVendido.name}</strong> ({masVendido.qty} unidades)</p>}
          {masRentable && <p>Más rentable: <strong>{masRentable.name}</strong> ({masRentable.profitPct!.toFixed(0)}%)</p>}
          {menosRentable && <p className="text-amber-700">Menos rentable: <strong>{menosRentable.name}</strong> ({menosRentable.profitPct!.toFixed(0)}%)</p>}
          {!masVendido && <p className="text-gray-400">Sin ventas en el rango.</p>}
        </div>
      )}
    </div>
  );
}
