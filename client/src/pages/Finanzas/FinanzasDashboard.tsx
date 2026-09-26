import { FormEvent, useEffect, useState } from "react";
import { api, Expense, ExpenseType, FinanceSummary } from "../../api/client";
import { useAuth } from "../../context/AuthContext";

const money = (n: number) =>
  n.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

const typeLabel: Record<ExpenseType, string> = { COST: "Costo", EXPENSE: "Gasto", INVESTMENT: "Inversión" };

export default function FinanzasDashboard() {
  const { currentStoreId } = useAuth();
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [form, setForm] = useState({ type: "EXPENSE" as ExpenseType, category: "", description: "", amount: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function load() {
    if (!currentStoreId) return;
    api.get<FinanceSummary>("/finance/summary", { params: { storeId: currentStoreId } }).then((res) => setSummary(res.data));
    api.get<Expense[]>("/expenses", { params: { storeId: currentStoreId } }).then((res) => setExpenses(res.data));
  }

  useEffect(load, [currentStoreId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!currentStoreId) return;
    const amount = Number(form.amount);
    if (!form.category.trim() || !amount || amount <= 0) {
      setError("Completa categoría y un monto válido");
      return;
    }
    setSaving(true);
    try {
      await api.post("/expenses", {
        storeId: currentStoreId,
        type: form.type,
        category: form.category,
        description: form.description || undefined,
        amount,
        date: new Date().toISOString(),
      });
      setForm({ type: "EXPENSE", category: "", description: "", amount: "" });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Finanzas</h1>

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
              {c.label === "EBITDA" && (
                <div className="text-xs text-gray-500">{summary.ebitdaPct.toFixed(1)}% de las ventas</div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="bg-white border rounded-lg p-4 max-w-xl space-y-3">
        <h2 className="font-semibold text-sm">Registrar costo / gasto / inversión</h2>
        <form onSubmit={handleSubmit} className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <select
              className="border rounded-md px-2 py-1 text-sm"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as ExpenseType })}
            >
              <option value="COST">Costo</option>
              <option value="EXPENSE">Gasto</option>
              <option value="INVESTMENT">Inversión</option>
            </select>
            <input
              className="border rounded-md px-2 py-1 text-sm"
              placeholder="Categoría (ej: Arriendo)"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            />
          </div>
          <input
            className="border rounded-md px-2 py-1 text-sm w-full"
            placeholder="Descripción (opcional)"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <div className="flex gap-2">
            <input
              type="number"
              className="border rounded-md px-2 py-1 text-sm flex-1"
              placeholder="Monto"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
            <button
              disabled={saving}
              className="bg-pink-600 text-white text-sm rounded-md px-3 py-1 disabled:opacity-50"
            >
              Guardar
            </button>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </form>
      </div>

      <div className="bg-white border rounded-lg divide-y">
        <div className="p-3 hidden sm:flex text-xs font-semibold text-gray-500 uppercase">
          <span className="w-28">Fecha</span>
          <span className="w-24">Tipo</span>
          <span className="flex-1">Categoría / Descripción</span>
          <span className="w-32 text-right">Valor</span>
        </div>
        {expenses.map((e) => (
          <div key={e.id} className="p-3 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-0 text-sm">
            <span className="w-28 text-gray-500">{new Date(e.date).toLocaleDateString("es-CO")}</span>
            <span className="w-24">{typeLabel[e.type]}</span>
            <span className="flex-1">
              {e.category}
              {e.description ? ` — ${e.description}` : ""}
            </span>
            <span className="w-32 sm:text-right">{money(Number(e.amount))}</span>
          </div>
        ))}
        {expenses.length === 0 && <p className="p-4 text-sm text-gray-500">Sin registros todavía.</p>}
      </div>
    </div>
  );
}
