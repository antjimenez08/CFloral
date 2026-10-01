import { FormEvent, useEffect, useMemo, useState } from "react";
import { api, Expense, RecordType } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { money } from "../../lib/labels";

const typeLabel: Record<RecordType, string> = { GASTO: "Gasto", COSTO: "Costo", INVERSION: "Inversión", OTRO: "Otro" };
const typeToListKey: Record<RecordType, string> = {
  GASTO: "expenseCategoriesGasto",
  COSTO: "expenseCategoriesCosto",
  INVERSION: "expenseCategoriesInversion",
  OTRO: "expenseCategoriesOtro",
};

export default function FacturasTab() {
  const { currentStoreId } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [lists, setLists] = useState<Record<string, string[]>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ type: "GASTO" as RecordType, category: "", description: "", amount: "", date: new Date().toISOString().slice(0, 10) });
  const [typeFilter, setTypeFilter] = useState<RecordType | "">("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function load() {
    if (!currentStoreId) return;
    api.get<Expense[]>("/expenses", { params: { storeId: currentStoreId } }).then((r) => setExpenses(r.data));
    api.get("/lists").then((r) => setLists(r.data)).catch(() => {});
  }
  useEffect(load, [currentStoreId]);

  const categories = lists[typeToListKey[form.type]] ?? [];
  const filtered = useMemo(() => expenses.filter((e) => !typeFilter || e.type === typeFilter).sort((a, b) => b.date.localeCompare(a.date)), [expenses, typeFilter]);

  function startEdit(e: Expense) {
    setEditingId(e.id);
    setForm({ type: e.type, category: e.category, description: e.description ?? "", amount: String(e.amount), date: e.date.slice(0, 10) });
  }
  function resetForm() {
    setEditingId(null);
    setForm({ type: "GASTO", category: "", description: "", amount: "", date: new Date().toISOString().slice(0, 10) });
  }

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
      const body = {
        storeId: currentStoreId,
        type: form.type,
        category: form.category,
        description: form.description || undefined,
        amount,
        date: new Date(form.date + "T00:00:00").toISOString(),
      };
      if (editingId) await api.put(`/expenses/${editingId}`, body);
      else await api.post("/expenses", body);
      resetForm();
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error || "No se pudo registrar");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    await api.delete(`/expenses/${id}`);
    load();
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border rounded-lg p-4 max-w-xl space-y-3">
        <h2 className="font-semibold text-sm">{editingId ? "Editar registro" : "Registro de facturas"}</h2>
        <form onSubmit={handleSubmit} className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <select className="border rounded-md px-2 py-1 text-sm" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as RecordType, category: "" })}>
              {Object.entries(typeLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input list="facturas-categorias" className="border rounded-md px-2 py-1 text-sm" placeholder="Categoría" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            <datalist id="facturas-categorias">{categories.map((c) => <option key={c} value={c} />)}</datalist>
          </div>
          <input className="border rounded-md px-2 py-1 text-sm w-full" placeholder="Descripción (opcional)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="flex gap-2">
            <input type="date" className="border rounded-md px-2 py-1 text-sm" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            <input type="number" className="border rounded-md px-2 py-1 text-sm flex-1" placeholder="Monto" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            <button disabled={saving} className="bg-pink-600 text-white text-sm rounded-md px-3 py-1 disabled:opacity-50">{saving ? "Guardando..." : editingId ? "Guardar" : "Registrar"}</button>
            {editingId && <button type="button" onClick={resetForm} className="border text-sm rounded-md px-3 py-1">Cancelar</button>}
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </form>
      </div>

      <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as RecordType | "")} className="border rounded-md px-2 py-1 text-sm">
        <option value="">Todos los tipos</option>
        {Object.entries(typeLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>

      <div className="bg-white border rounded-lg divide-y">
        <div className="p-3 hidden sm:flex text-xs font-semibold text-gray-500 uppercase">
          <span className="w-28">Fecha</span>
          <span className="w-24">Tipo</span>
          <span className="flex-1">Categoría / Descripción</span>
          <span className="w-32 text-right">Valor</span>
          <span className="w-20"></span>
        </div>
        {filtered.map((e) => (
          <div key={e.id} className="p-3 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-0 text-sm">
            <span className="w-28 text-gray-500">{new Date(e.date).toLocaleDateString("es-CO")}</span>
            <span className="w-24">{typeLabel[e.type]}</span>
            <span className="flex-1">{e.category}{e.description ? ` — ${e.description}` : ""}</span>
            <span className="w-32 sm:text-right">{money(e.amount)}</span>
            <span className="w-20 flex gap-2 justify-end">
              <button onClick={() => startEdit(e)} className="text-xs text-pink-700">Editar</button>
              <button onClick={() => remove(e.id)} className="text-xs text-red-600">Eliminar</button>
            </span>
          </div>
        ))}
        {filtered.length === 0 && <p className="p-4 text-sm text-gray-500">Sin registros todavía.</p>}
      </div>
    </div>
  );
}
