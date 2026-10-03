import { FormEvent, useEffect, useMemo, useState } from "react";
import { api, Payment, PaymentKind, PayeeType, Supplier } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { money } from "../../lib/labels";
import SortHeader, { compareValues, SortDir, toggleSort } from "../../components/SortHeader";

const typeLabel: Record<PaymentKind, string> = { PROVEEDOR: "Proveedor", NOMINA: "Nómina", CREDITO: "Crédito", OTRO: "Otro" };

type PaymentSortKey = "date" | "type" | "amount" | "status";

interface EmployeeOption {
  id: string;
  name: string;
}

interface ListsResponse {
  paymentMethods?: string[];
  [key: string]: unknown;
}

interface Props {
  storeId?: string;
}

export default function PagosTab({ storeId }: Props) {
  const { currentStoreId } = useAuth();
  // La tabla se ve con el alcance elegido en Finanzas (puede ser "todas las tiendas"),
  // pero registrar un pago siempre es para la tienda activa en el topbar.
  const createStoreId = currentStoreId ?? undefined;
  const [payments, setPayments] = useState<Payment[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [lists, setLists] = useState<ListsResponse>({});
  const [statusFilter, setStatusFilter] = useState<Payment["status"] | "">("");
  const [typeFilter, setTypeFilter] = useState<PaymentKind | "">("");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<PaymentSortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [form, setForm] = useState({
    type: "PROVEEDOR" as PaymentKind,
    payeeType: "PROVEEDOR" as PayeeType,
    supplierId: "",
    employeeId: "",
    payeeName: "",
    amount: "",
    date: new Date().toISOString().slice(0, 10),
    method: "",
    status: "PENDIENTE" as Payment["status"],
    notes: "",
  });

  function onSort(key: PaymentSortKey) {
    toggleSort(key, sortKey, sortDir, setSortKey, setSortDir);
  }

  function load() {
    api.get<Payment[]>("/payments", { params: { storeId, status: statusFilter || undefined, type: typeFilter || undefined } }).then((r) => setPayments(r.data));
    api.get<Supplier[]>("/suppliers").then((r) => setSuppliers(r.data));
    api.get<EmployeeOption[]>("/users/directory").then((r) => setEmployees(r.data)).catch(() => {});
    api.get<ListsResponse>("/lists").then((r) => setLists(r.data)).catch(() => {});
  }
  useEffect(load, [storeId, statusFilter, typeFilter]);

  const paymentMethodOptions = lists.paymentMethods ?? [];

  const visiblePayments = useMemo(() => {
    const term = search.trim().toLowerCase();
    let list = payments;
    if (term) {
      list = list.filter(
        (p) =>
          (p.supplier?.name ?? "").toLowerCase().includes(term) ||
          (p.employee?.name ?? "").toLowerCase().includes(term) ||
          (p.payeeName ?? "").toLowerCase().includes(term) ||
          (p.notes ?? "").toLowerCase().includes(term)
      );
    }
    if (sortKey) {
      list = [...list].sort((a, b) => {
        const cmp = sortKey === "amount" ? Number(a.amount) - Number(b.amount) : compareValues(a[sortKey], b[sortKey]);
        return sortDir === "asc" ? cmp : -cmp;
      });
    }
    return list;
  }, [payments, search, sortKey, sortDir]);

  const pagado = payments.filter((p) => p.status === "PAGADO").reduce((s, p) => s + Number(p.amount), 0);
  const pendiente = payments.filter((p) => p.status === "PENDIENTE").reduce((s, p) => s + Number(p.amount), 0);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!createStoreId || !form.amount) return;
    await api.post("/payments", {
      storeId: createStoreId,
      type: form.type,
      payeeType: form.payeeType,
      supplierId: form.payeeType === "PROVEEDOR" ? form.supplierId || undefined : undefined,
      employeeId: form.payeeType === "EMPLEADO" ? form.employeeId || undefined : undefined,
      payeeName: form.payeeType === "OTRO" ? form.payeeName || undefined : undefined,
      amount: Number(form.amount),
      date: new Date(form.date + "T00:00:00").toISOString(),
      method: form.method || undefined,
      status: form.status,
      notes: form.notes || undefined,
    });
    setForm({ ...form, amount: "", payeeName: "", notes: "", status: "PENDIENTE" });
    load();
  }

  async function markPaid(id: string) {
    await api.put(`/payments/${id}`, { status: "PAGADO" });
    load();
  }
  async function remove(id: string) {
    await api.delete(`/payments/${id}`);
    load();
  }

  function payeeName(p: Payment): string {
    if (p.payeeType === "PROVEEDOR") return p.supplier?.name ?? "—";
    if (p.payeeType === "EMPLEADO") return p.employee?.name ?? "—";
    return p.payeeName ?? "—";
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 max-w-md">
        <div className="bg-white border rounded-lg p-3">
          <div className="text-xs uppercase text-gray-500">Pagado</div>
          <div className="text-lg font-bold text-green-700">{money(pagado)}</div>
        </div>
        <div className="bg-white border rounded-lg p-3">
          <div className="text-xs uppercase text-gray-500">Pendiente</div>
          <div className="text-lg font-bold text-red-700">{money(pendiente)}</div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white border rounded-lg p-4 max-w-xl space-y-2">
        <h2 className="font-semibold text-sm">Liquidación de pagos</h2>
        <div className="grid grid-cols-2 gap-2">
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as PaymentKind })} className="border rounded-md px-2 py-1 text-sm">
            {Object.entries(typeLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={form.payeeType} onChange={(e) => setForm({ ...form, payeeType: e.target.value as PayeeType })} className="border rounded-md px-2 py-1 text-sm">
            <option value="PROVEEDOR">Proveedor</option>
            <option value="EMPLEADO">Empleado</option>
            <option value="OTRO">Otro beneficiario</option>
          </select>
        </div>
        {form.payeeType === "PROVEEDOR" && (
          <select value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })} className="w-full border rounded-md px-2 py-1 text-sm">
            <option value="">Selecciona proveedor...</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
        {form.payeeType === "EMPLEADO" && (
          <select value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} className="w-full border rounded-md px-2 py-1 text-sm">
            <option value="">Selecciona empleado...</option>
            {employees.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
        {form.payeeType === "OTRO" && (
          <input placeholder="Nombre del beneficiario" value={form.payeeName} onChange={(e) => setForm({ ...form, payeeName: e.target.value })} className="w-full border rounded-md px-2 py-1 text-sm" />
        )}
        <div className="flex gap-2">
          <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="border rounded-md px-2 py-1 text-sm" />
          <input type="number" placeholder="Monto" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="border rounded-md px-2 py-1 text-sm flex-1" />
          {paymentMethodOptions.length > 0 ? (
            <select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} className="border rounded-md px-2 py-1 text-sm w-32">
              <option value="">Método...</option>
              {paymentMethodOptions.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          ) : (
            <input placeholder="Método" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} className="border rounded-md px-2 py-1 text-sm w-32" />
          )}
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Payment["status"] })} className="border rounded-md px-2 py-1 text-sm w-32">
            <option value="PENDIENTE">Pendiente</option>
            <option value="PAGADO">Pagado</option>
          </select>
        </div>
        <input placeholder="Notas (opcional)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full border rounded-md px-2 py-1 text-sm" />
        <button className="bg-pink-600 text-white text-sm rounded-md px-3 py-1.5">Registrar pago</button>
      </form>

      <div className="flex flex-wrap gap-2">
        <input
          placeholder="Buscar por beneficiario o notas..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] border rounded-md px-2 py-1 text-sm"
        />
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as PaymentKind | "")} className="border rounded-md px-2 py-1 text-sm">
          <option value="">Todos los tipos</option>
          {Object.entries(typeLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as Payment["status"] | "")} className="border rounded-md px-2 py-1 text-sm">
          <option value="">Todos los estados</option>
          <option value="PENDIENTE">Pendiente</option>
          <option value="PAGADO">Pagado</option>
        </select>
      </div>

      <div className="bg-white border rounded-lg divide-y overflow-x-auto">
        <div className="p-3 hidden sm:flex text-xs font-semibold text-gray-500 uppercase min-w-[680px]">
          <span className="w-28"><SortHeader label="Fecha" sortKey="date" active={sortKey} dir={sortDir} onClick={onSort} /></span>
          {!storeId && <span className="w-28">Tienda</span>}
          <span className="w-24"><SortHeader label="Tipo" sortKey="type" active={sortKey} dir={sortDir} onClick={onSort} /></span>
          <span className="flex-1">Beneficiario</span>
          <span className="w-28 text-right"><SortHeader label="Valor" sortKey="amount" active={sortKey} dir={sortDir} onClick={onSort} className="justify-end" /></span>
          <span className="w-24"><SortHeader label="Estado" sortKey="status" active={sortKey} dir={sortDir} onClick={onSort} /></span>
          <span className="w-32"></span>
        </div>
        {visiblePayments.map((p) => (
          <div key={p.id} className="p-3 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-0 text-sm min-w-[680px]">
            <span className="w-28 text-gray-500">{new Date(p.date).toLocaleDateString("es-CO")}</span>
            {!storeId && <span className="w-28 text-gray-500">{p.store?.name ?? "—"}</span>}
            <span className="w-24">{typeLabel[p.type]}</span>
            <span className="flex-1">
              {payeeName(p)}
              {p.method && <span className="block text-xs text-gray-400">{p.method}</span>}
              {p.notes && <span className="block text-xs text-gray-400">{p.notes}</span>}
            </span>
            <span className="w-28 sm:text-right">{money(p.amount)}</span>
            <span className="w-24">
              <span className={`px-2 py-0.5 rounded-full text-xs ${p.status === "PAGADO" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>
                {p.status === "PAGADO" ? "Pagado" : "Pendiente"}
              </span>
            </span>
            <span className="w-32 flex gap-2 justify-end">
              {p.status === "PENDIENTE" && <button onClick={() => markPaid(p.id)} className="text-xs text-pink-700">Marcar pagado</button>}
              <button onClick={() => remove(p.id)} className="text-xs text-red-600">Quitar</button>
            </span>
          </div>
        ))}
        {visiblePayments.length === 0 && <p className="p-4 text-sm text-gray-500">Sin pagos registrados.</p>}
      </div>
    </div>
  );
}
