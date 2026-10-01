import { FormEvent, useEffect, useState } from "react";
import { api, Supplier } from "../../api/client";
import { useAuth } from "../../context/AuthContext";

const emptyForm = {
  name: "",
  contactName: "",
  phone: "",
  email: "",
  address: "",
  city: "",
  taxId: "",
  categories: "",
  paymentTerms: "",
  leadTimeDays: "",
  rating: "",
  notes: "",
};

function stars(rating: number | null) {
  if (!rating) return "—";
  return "★".repeat(rating) + "☆".repeat(5 - rating);
}

export default function ProveedoresTab() {
  const { can } = useAuth();
  if (!can("proveedores")) {
    return <p className="text-sm text-gray-500">No tienes permiso para ver los proveedores.</p>;
  }
  return <ProveedoresTabInner />;
}

function ProveedoresTabInner() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const res = await api.get<Supplier[]>("/suppliers");
    setSuppliers(res.data);
  }

  useEffect(() => {
    load();
  }, []);

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
    setError(null);
  }

  function toggleForm() {
    if (showForm) {
      resetForm();
      setShowForm(false);
    } else {
      resetForm();
      setShowForm(true);
    }
  }

  function openEdit(s: Supplier) {
    setEditingId(s.id);
    setForm({
      name: s.name,
      contactName: s.contactName || "",
      phone: s.phone || "",
      email: s.email || "",
      address: s.address || "",
      city: s.city || "",
      taxId: s.taxId || "",
      categories: s.categories || "",
      paymentTerms: s.paymentTerms || "",
      leadTimeDays: s.leadTimeDays != null ? String(s.leadTimeDays) : "",
      rating: s.rating != null ? String(s.rating) : "",
      notes: s.notes || "",
    });
    setError(null);
    setShowForm(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) {
      setError("El nombre es obligatorio");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        contactName: form.contactName || undefined,
        phone: form.phone || undefined,
        email: form.email || undefined,
        address: form.address || undefined,
        city: form.city || undefined,
        taxId: form.taxId || undefined,
        categories: form.categories || undefined,
        paymentTerms: form.paymentTerms || undefined,
        leadTimeDays: form.leadTimeDays ? Number(form.leadTimeDays) : undefined,
        rating: form.rating ? Number(form.rating) : undefined,
        notes: form.notes || undefined,
      };
      if (editingId) {
        await api.put(`/suppliers/${editingId}`, payload);
      } else {
        await api.post("/suppliers", payload);
      }
      resetForm();
      setShowForm(false);
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error || "No se pudo guardar el proveedor");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(s: Supplier) {
    await api.put(`/suppliers/${s.id}`, { active: !s.active });
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Proveedores</h2>
        <button onClick={toggleForm} className="bg-pink-600 text-white text-sm rounded-md px-3 py-2">
          {showForm ? "Cancelar" : "Nuevo proveedor"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white p-4 rounded-lg border space-y-3 max-w-2xl">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1">Nombre</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full border rounded-md px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">NIT / documento</label>
              <input value={form.taxId} onChange={(e) => setForm({ ...form, taxId: e.target.value })} className="w-full border rounded-md px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Persona de contacto</label>
              <input
                value={form.contactName}
                onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                className="w-full border rounded-md px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Teléfono</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full border rounded-md px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full border rounded-md px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Ciudad</label>
              <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="w-full border rounded-md px-3 py-2" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1">Dirección</label>
              <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="w-full border rounded-md px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Categorías que suministra</label>
              <input
                placeholder="Flores, follaje..."
                value={form.categories}
                onChange={(e) => setForm({ ...form, categories: e.target.value })}
                className="w-full border rounded-md px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Condiciones de pago</label>
              <input
                placeholder="Contado, 30 días..."
                value={form.paymentTerms}
                onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })}
                className="w-full border rounded-md px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Tiempo de entrega (días)</label>
              <input
                type="number"
                min="0"
                value={form.leadTimeDays}
                onChange={(e) => setForm({ ...form, leadTimeDays: e.target.value })}
                className="w-full border rounded-md px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Calificación (1-5)</label>
              <input
                type="number"
                min="1"
                max="5"
                value={form.rating}
                onChange={(e) => setForm({ ...form, rating: e.target.value })}
                className="w-full border rounded-md px-3 py-2"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1">Notas</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full border rounded-md px-3 py-2"
                rows={2}
              />
            </div>
          </div>
          <button disabled={saving} type="submit" className="bg-pink-600 text-white rounded-md px-4 py-2 text-sm disabled:opacity-50">
            Guardar
          </button>
        </form>
      )}

      <div className="bg-white rounded-lg border divide-y overflow-x-auto">
        <div className="p-3 hidden sm:flex text-xs font-semibold text-gray-500 uppercase min-w-[720px]">
          <span className="flex-1">Proveedor</span>
          <span className="w-40">Contacto</span>
          <span className="w-32">Suministra</span>
          <span className="w-28">Pago</span>
          <span className="w-16 text-center">Entrega</span>
          <span className="w-24">Calificación</span>
          <span className="w-24 text-right">Estado</span>
        </div>
        {suppliers.map((s) => (
          <div key={s.id} className="p-3 flex flex-col sm:flex-row sm:items-center text-sm gap-1 sm:gap-0 min-w-[720px]">
            <span className="flex-1 cursor-pointer" onClick={() => openEdit(s)}>
              <span className="font-medium">{s.name}</span>
              {s.taxId && <span className="block text-xs text-gray-400">{s.taxId}</span>}
            </span>
            <span className="w-40 text-gray-500">
              {s.contactName || "—"}
              {s.phone && <span className="block text-xs">{s.phone}</span>}
            </span>
            <span className="w-32 text-gray-500">{s.categories || "—"}</span>
            <span className="w-28 text-gray-500">{s.paymentTerms || "—"}</span>
            <span className="w-16 text-center text-gray-500">{s.leadTimeDays != null ? `${s.leadTimeDays}d` : "—"}</span>
            <span className="w-24 text-amber-500">{stars(s.rating)}</span>
            <span className="w-24 sm:text-right">
              <button
                onClick={() => toggleActive(s)}
                className={`text-xs rounded-md px-2 py-1 border ${
                  s.active ? "text-gray-600 hover:bg-gray-50" : "text-green-700 border-green-300 hover:bg-green-50"
                }`}
              >
                {s.active ? "Desactivar" : "Activar"}
              </button>
            </span>
          </div>
        ))}
        {suppliers.length === 0 && <p className="p-4 text-sm text-gray-500">Sin proveedores registrados.</p>}
      </div>
    </div>
  );
}
