import { useEffect, useMemo, useState } from "react";
import { api, BudgetEntry, Order, Product } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { money } from "../../lib/labels";
import { GroupedBarChart } from "./charts";

interface DraftRow {
  productName: string;
  quantity: number;
  unitPrice: number;
}

export default function PresupuestosTab() {
  const { currentStoreId } = useAuth();
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [products, setProducts] = useState<Product[]>([]);
  const [budgets, setBudgets] = useState<BudgetEntry[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [draft, setDraft] = useState<DraftRow[]>([]);
  const [productToAdd, setProductToAdd] = useState("");
  const [qtyToAdd, setQtyToAdd] = useState(1);
  const [saving, setSaving] = useState(false);

  function load() {
    if (!currentStoreId) return;
    api.get<Product[]>("/products", { params: { storeId: currentStoreId } }).then((r) => setProducts(r.data));
    api.get<BudgetEntry[]>("/budgets", { params: { storeId: currentStoreId, month } }).then((r) => setBudgets(r.data));
    api.get<Order[]>("/orders", { params: { storeId: currentStoreId } }).then((r) => setOrders(r.data));
  }
  useEffect(load, [currentStoreId, month]);

  const realByProduct = useMemo(() => {
    const map = new Map<string, number>();
    orders
      .filter((o) => o.status !== "CANCELLED" && o.createdAt.slice(0, 7) === month)
      .forEach((o) => o.items.forEach((it) => map.set(it.productName, (map.get(it.productName) ?? 0) + Number(it.subtotal))));
    return map;
  }, [orders, month]);

  function addRow() {
    const product = products.find((p) => p.id === productToAdd);
    if (!product || qtyToAdd <= 0) return;
    setDraft((prev) => [...prev, { productName: product.name, quantity: qtyToAdd, unitPrice: Number(product.unitPrice) }]);
    setProductToAdd("");
    setQtyToAdd(1);
  }

  async function saveBudget() {
    if (!currentStoreId || draft.length === 0) return;
    setSaving(true);
    try {
      await api.post("/budgets", {
        storeId: currentStoreId,
        month,
        items: draft.map((d) => ({ productName: d.productName, quantity: d.quantity, unitPrice: d.unitPrice })),
      });
      setDraft([]);
      load();
    } finally {
      setSaving(false);
    }
  }

  const draftTotal = draft.reduce((s, d) => s + d.quantity * d.unitPrice, 0);

  const comparison = budgets
    .map((b) => {
      const real = realByProduct.get(b.productName) ?? 0;
      const presupuesto = Number(b.amount);
      const cumplimiento = presupuesto > 0 ? (real / presupuesto) * 100 : real > 0 ? 100 : 0;
      return { ...b, real, cumplimiento };
    })
    .sort((a, b) => Number(b.amount) - Number(a.amount));

  const chartData = comparison.map((c) => ({ label: c.productName.slice(0, 10), series: { Presupuesto: Number(c.amount), Real: c.real } }));

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-xs text-gray-500 mb-1">Mes</label>
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="border rounded-md px-2 py-1 text-sm" />
      </div>

      <div className="bg-white border rounded-lg p-4 space-y-3 max-w-xl">
        <h3 className="font-medium text-sm">Crear presupuesto</h3>
        <div className="flex gap-2">
          <select value={productToAdd} onChange={(e) => setProductToAdd(e.target.value)} className="flex-1 border rounded-md px-2 py-1 text-sm">
            <option value="">Selecciona un producto...</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <input type="number" min={1} value={qtyToAdd} onChange={(e) => setQtyToAdd(Number(e.target.value))} className="w-20 border rounded-md px-2 py-1 text-sm" />
          <button type="button" onClick={addRow} className="border rounded-md px-3 py-1 text-sm">Agregar</button>
        </div>
        {draft.map((d, i) => (
          <div key={i} className="flex justify-between text-sm">
            <span>{d.quantity}x {d.productName}</span>
            <span>{money(d.quantity * d.unitPrice)}</span>
          </div>
        ))}
        {draft.length > 0 && (
          <>
            <div className="flex justify-between font-semibold text-sm border-t pt-2">
              <span>Total presupuestado</span>
              <span>{money(draftTotal)}</span>
            </div>
            <button onClick={saveBudget} disabled={saving} className="bg-pink-600 text-white text-sm rounded-md px-3 py-1.5 disabled:opacity-50">
              {saving ? "Guardando..." : "Guardar presupuesto"}
            </button>
          </>
        )}
      </div>

      {comparison.length > 0 && (
        <div className="bg-white border rounded-lg p-4 space-y-3">
          <h3 className="font-medium text-sm">Presupuesto vs real</h3>
          <GroupedBarChart data={chartData} seriesKeys={["Presupuesto", "Real"]} />
          <table className="w-full text-sm">
            <thead><tr className="text-left text-gray-500 border-b"><th className="py-1">Producto</th><th className="text-right">Presupuesto</th><th className="text-right">Real</th><th className="text-right">% Cumplimiento</th></tr></thead>
            <tbody>
              {comparison.map((c) => (
                <tr key={c.id} className="border-b">
                  <td className="py-1">{c.productName}</td>
                  <td className="text-right">{money(c.amount)}</td>
                  <td className="text-right">{money(c.real)}</td>
                  <td className={`text-right ${c.cumplimiento >= 100 ? "text-green-700" : c.cumplimiento < 70 ? "text-red-700" : "text-amber-700"}`}>{c.cumplimiento.toFixed(0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
