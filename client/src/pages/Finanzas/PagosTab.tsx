import { FormEvent, useEffect, useState } from "react";
import { api, Payment, PaymentKind, PayeeType, Supplier } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { money } from "../../lib/labels";

const typeLabel: Record<PaymentKind, string> = { PROVEEDOR: "Proveedor", NOMINA: "Nómina", CREDITO: "Crédito", OTRO: "Otro" };

interface EmployeeOption {
  id: string;
  name: string;
}

export default function PagosTab() {
  const { currentStoreId, can } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [statusFilter, setStatusFilter] = useState<Payment["status"] | "">("");
  const [typeFilter, setTypeFilter] = useState<PaymentKind | "">("");
  const [form, setForm] = useState({
    type: "PROVEEDOR" as PaymentKind,
    payeeType: "PROVEEDOR" as PayeeType,
    supplierId: "",
    employeeId: "",
    payeeName: "",
    amount: "",
    date: new Date().toISOString().slice(0, 10),
    method: "",
  });

  function load() {
    if (!currentStoreId) return;
    api.get<Payment[]>("/payments", { params: { storeId: currentStoreId, status: statusFilter || undefined, type: typeFilter || undefined } }).then((r) => setPayments(r.data));
    api.get<Supplier[]>("/suppliers").then((r) => setSuppliers(r.data));
    if (can("empleados")) api.get<EmployeeOption[]>("/users").then((r) => setEmployees(r.data)).catch(() => {});
  }
  useEffect(load, [currentStoreId, statusFilter, typeFilter]);

  const pagado = payments.filter((p) => p.status === "PAGADO").reduce((s, p) => s + Number(p.amount), 0);
  const pendiente = payments.filter((p) => p.status === "PENDIENTE").reduce((s, p) => s + Number(p.amount), 0);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!currentStoreId || !form.amount) return;
    await api.post("/payments", {
      storeId: currentStoreId,
      type: form.type,
      payeeType: form.payeeType,
      supplierId: form.payeeType === "PROVEEDOR" ? form.supplierId || undefined : undefined,
      employeeId: form.payeeType === "EMPLEADO" ? form.employeeId || undefined : undefined,
      payeeName: form.payeeType === "OTRO" ? form.payeeName || undefined : undefined,
      amount: Number(form.amount),
      date: new Date(form.date + "T00:00:00").toISOString(),
      method: form.method || undefined,
    });
    setForm({ ...form, amount: "", payeeName: "" });
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
          <input placeholder="Método" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} className="border rounded-md px-2 py-1 text-sm w-32" />
        </div>
        <button className="bg-pink-600 text-white text-sm rounded-md px-3 py-1.5">Registrar pago</button>
      </form>

      <div className="flex gap-2">
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

      <div className="bg-white border rounded-lg divide-y">
        {payments.map((p) => (
          <div key={p.id} className="p-3 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-0 text-sm">
            <span className="w-28 text-gray-500">{new Date(p.date).toLocaleDateString("es-CO")}</span>
            <span className="w-24">{typeLabel[p.type]}</span>
            <span className="flex-1">{payeeName(p)}</span>
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
        {payments.length === 0 && <p className="p-4 text-sm text-gray-500">Sin pagos registrados.</p>}
      </div>
    </div>
  );
}
