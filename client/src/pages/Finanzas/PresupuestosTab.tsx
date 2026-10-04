import { useEffect, useState } from "react";
import { api, BudgetComparison, BudgetEntry, Product } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { money } from "../../lib/labels";
import { GroupedBarChart } from "./charts";

const MONTH_NAMES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
function monthLabel(key: string) {
  const [y, m] = key.split("-");
  return `${MONTH_NAMES[Number(m) - 1]} ${y}`;
}

interface Row {
  productId: string;
  qty: number;
}

interface Props {
  storeId?: string;
}

export default function PresupuestosTab({ storeId }: Props) {
  const { currentStoreId } = useAuth();
  // El formulario de creación siempre es para la tienda activa en el topbar (un presupuesto
  // es por tienda); la comparación se ve con el alcance elegido en Finanzas (puede ser "todas
  // las tiendas").
  const createStoreId = currentStoreId ?? undefined;
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [products, setProducts] = useState<Product[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [comparison, setComparison] = useState<BudgetComparison | null>(null);
  const [saving, setSaving] = useState(false);

  function loadComparison() {
    api
      .get<BudgetComparison>("/budgets/comparison", { params: { storeId, month } })
      .then((r) => setComparison(r.data))
      .catch(() => setComparison(null));
  }
  useEffect(loadComparison, [storeId, month]);

  // Las filas del formulario se reconstruyen solo cuando cambia tienda+mes: primero desde el
  // presupuesto ya guardado para ese mes, y si no hay ninguno, con los productos de la tienda
  // en cantidad 0 como punto de partida (igual que ensurePresupuestoFormRows() del mockup).
  useEffect(() => {
    if (!createStoreId) {
      setProducts([]);
      setRows([]);
      return;
    }
    Promise.all([
      api.get<Product[]>("/products", { params: { storeId: createStoreId } }),
      api.get<BudgetEntry[]>("/budgets", { params: { storeId: createStoreId, month } }),
    ]).then(([pRes, eRes]) => {
      setProducts(pRes.data);
      const entries = eRes.data;
      if (entries.length) {
        const nextRows = entries
          .map((e) => ({ productId: pRes.data.find((p) => p.name === e.productName)?.id ?? "", qty: e.quantity }))
          .filter((r) => r.productId);
        setRows(nextRows.length ? nextRows : [{ productId: "", qty: 0 }]);
      } else {
        setRows(pRes.data.length ? pRes.data.map((p) => ({ productId: p.id, qty: 0 })) : [{ productId: "", qty: 0 }]);
      }
    });
  }, [createStoreId, month]);

  function setRow(i: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function removeRow(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  }
  function addRow() {
    setRows((prev) => [...prev, { productId: "", qty: 0 }]);
  }

  async function saveBudget() {
    if (!createStoreId) return;
    setSaving(true);
    try {
      const items = rows
        .map((r) => ({ product: products.find((p) => p.id === r.productId), qty: r.qty }))
        .filter((r): r is { product: Product; qty: number } => !!r.product && r.qty > 0)
        .map((r) => ({ productName: r.product.name, quantity: r.qty, unitPrice: Number(r.product.unitPrice) }));
      await api.put("/budgets", { storeId: createStoreId, month, items });
      loadComparison();
    } finally {
      setSaving(false);
    }
  }

  const total = rows.reduce((s, r) => {
    const p = products.find((x) => x.id === r.productId);
    return s + (p ? r.qty * Number(p.unitPrice) : 0);
  }, 0);

  const cumplimientoGroups = (comparison?.rows ?? []).map((r) => ({ label: r.name.slice(0, 14), series: { Presupuesto: r.presupuesto, Real: r.real } }));

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-xs text-gray-500 mb-1">Mes del presupuesto</label>
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="border rounded-md px-2 py-1 text-sm" />
      </div>

      {!createStoreId ? (
        <div className="bg-white border rounded-lg p-4">
          <h3 className="font-medium text-sm mb-1">Crear presupuesto</h3>
          <p className="text-sm text-gray-500">Selecciona una tienda específica arriba en el topbar para crear o editar su presupuesto de ventas por producto.</p>
        </div>
      ) : (
        <div className="bg-white border rounded-lg p-4 space-y-3">
          <h3 className="font-medium text-sm">Crear presupuesto</h3>
          <p className="text-xs text-gray-500">
            Busca y agrega los productos de la meta del mes, indica la cantidad esperada de ventas de cada uno y el sistema calcula el subtotal (cantidad × precio de venta). La meta total es la suma de todos los productos.
          </p>
          <div className="flex gap-2 text-xs font-semibold text-gray-500 uppercase px-1">
            <span className="flex-1">Producto</span>
            <span className="w-16 text-center">Cant.</span>
            <span className="w-24 text-right">Precio unit.</span>
            <span className="w-28 text-right">Subtotal</span>
            <span className="w-16"></span>
          </div>
          {rows.map((row, i) => {
            const p = products.find((x) => x.id === row.productId);
            const subtotal = p ? row.qty * Number(p.unitPrice) : 0;
            return (
              <div key={i} className="flex gap-2 items-center">
                <select value={row.productId} onChange={(e) => setRow(i, { productId: e.target.value })} className="flex-1 border rounded-md px-2 py-1 text-sm">
                  <option value="">Selecciona un producto</option>
                  {products.map((prod) => <option key={prod.id} value={prod.id}>{prod.name}</option>)}
                </select>
                <input type="number" min={0} step={1} value={row.qty} onChange={(e) => setRow(i, { qty: Number(e.target.value) })} className="w-16 border rounded-md px-2 py-1 text-sm text-center" />
                <span className="w-24 text-right text-xs text-gray-500">{p ? money(p.unitPrice) : "—"}</span>
                <span className="w-28 text-right text-sm font-semibold">{money(subtotal)}</span>
                <button type="button" onClick={() => removeRow(i)} className="w-16 text-xs text-red-600">Quitar</button>
              </div>
            );
          })}
          <button type="button" onClick={addRow} className="text-xs border rounded-md px-3 py-1.5">+ Agregar producto</button>
          <div className="flex justify-end items-baseline gap-2 pt-2 border-t">
            <span className="text-sm text-gray-500">Meta total del mes</span>
            <span className="text-lg font-bold">{money(total)}</span>
          </div>
          <button type="button" onClick={saveBudget} disabled={saving} className="bg-pink-600 text-white text-sm rounded-md px-3 py-1.5 disabled:opacity-50">
            {saving ? "Guardando..." : "Guardar presupuesto"}
          </button>
        </div>
      )}

      <div className="bg-white border rounded-lg p-4 space-y-3">
        <h3 className="font-medium text-sm">Presupuesto de ventas por producto</h3>
        <p className="text-xs text-gray-500">
          Presupuesto para {monthLabel(month)} (el que definiste manualmente, o el promedio sugerido de los últimos {comparison?.priorMonthsCount ?? 3} meses cuando no defines uno) vs. las ventas reales del mes, y su % de cumplimiento.
        </p>
        {comparison && comparison.rows.length > 0 ? (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-gray-500 border-b"><th className="py-1">Producto</th><th className="text-right">Presupuesto</th><th className="text-right">Real</th><th className="text-right">Cumplimiento</th></tr></thead>
            <tbody>
              {comparison.rows.map((r) => (
                <tr key={r.name} className="border-b">
                  <td className="py-1">{r.name} {r.manual && <span className="text-gray-400 text-xs">(manual)</span>}</td>
                  <td className="text-right">{money(r.presupuesto)}</td>
                  <td className="text-right">{money(r.real)}</td>
                  <td className={`text-right ${r.cumplimiento == null ? "text-gray-400" : r.cumplimiento >= 100 ? "text-green-700" : r.cumplimiento < 70 ? "text-red-700" : "text-amber-700"}`}>
                    {r.cumplimiento == null ? "—" : `${r.cumplimiento.toFixed(0)}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-gray-500">Aún no hay suficientes datos para generar un presupuesto.</p>
        )}
      </div>

      {cumplimientoGroups.length > 0 && (
        <div className="bg-white border rounded-lg p-4 space-y-3">
          <h3 className="font-medium text-sm">Cumplimiento vs. presupuesto</h3>
          <p className="text-xs text-gray-500">Ventas reales de {monthLabel(month)} comparadas con el presupuesto, por producto.</p>
          <GroupedBarChart data={cumplimientoGroups} seriesKeys={["Presupuesto", "Real"]} />
        </div>
      )}
    </div>
  );
}
