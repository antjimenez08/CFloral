import { FormEvent, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, Customer } from "../../api/client";
import { channelLabel, monthLabel, occasionLabel } from "../../lib/labels";

export default function ClienteDetail() {
  const { id } = useParams();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [showDateForm, setShowDateForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await api.get<Customer>(`/customers/${id}`);
    setCustomer(res.data);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleAddAddress(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    try {
      await api.post(`/customers/${id}/addresses`, {
        label: form.get("label"),
        recipientName: form.get("recipientName") || undefined,
        phone: form.get("phone") || undefined,
        address: form.get("address"),
        city: form.get("city") || undefined,
      });
      setShowAddressForm(false);
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error || "No se pudo agregar la dirección");
    }
  }

  async function handleDeleteAddress(addressId: string) {
    await api.delete(`/customers/${id}/addresses/${addressId}`);
    load();
  }

  async function handleAddDate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    try {
      await api.post(`/customers/${id}/special-dates`, {
        label: form.get("label"),
        occasion: form.get("occasion") || undefined,
        month: Number(form.get("month")),
        day: Number(form.get("day")),
      });
      setShowDateForm(false);
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error || "No se pudo agregar la fecha");
    }
  }

  async function handleDeleteDate(dateId: string) {
    await api.delete(`/customers/${id}/special-dates/${dateId}`);
    load();
  }

  if (!customer) return <p className="text-sm text-gray-500">Cargando...</p>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Link to="/clientes" className="text-sm text-pink-700 hover:underline">
          ← Volver a clientes
        </Link>
        <div className="flex items-center gap-2 mt-1">
          <h1 className="text-xl font-semibold">{customer.name}</h1>
          {customer.type === "CORPORATE" && (
            <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">Empresa</span>
          )}
        </div>
        <p className="text-sm text-gray-500">{customer.phone} {customer.email && `· ${customer.email}`}</p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-lg border p-3 text-center">
          <p className="text-xs text-gray-500 uppercase">Pedidos</p>
          <p className="text-lg font-semibold">{customer.ordersCount}</p>
        </div>
        <div className="bg-white rounded-lg border p-3 text-center">
          <p className="text-xs text-gray-500 uppercase">Valor total</p>
          <p className="text-lg font-semibold">${Number(customer.lifetimeValue).toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-lg border p-3 text-center">
          <p className="text-xs text-gray-500 uppercase">Última compra</p>
          <p className="text-lg font-semibold">
            {customer.lastOrderAt ? new Date(customer.lastOrderAt).toLocaleDateString() : "—"}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg border p-4 text-sm space-y-1">
        <p><span className="text-gray-500">Documento:</span> {customer.documentId || "—"}</p>
        <p><span className="text-gray-500">Fecha de nacimiento:</span> {customer.birthDate ? new Date(customer.birthDate).toLocaleDateString() : "—"}</p>
        <p><span className="text-gray-500">Contacto preferido:</span> {customer.preferredContact ? channelLabel[customer.preferredContact] : "—"}</p>
        <p><span className="text-gray-500">Canal de adquisición:</span> {customer.acquisitionChannel ? channelLabel[customer.acquisitionChannel] : "—"}</p>
        {customer.tags && (
          <p className="flex gap-1 flex-wrap">
            <span className="text-gray-500">Etiquetas:</span>
            {customer.tags.split(",").map((t) => (
              <span key={t} className="bg-pink-50 text-pink-700 text-xs px-1.5 py-0.5 rounded">{t.trim()}</span>
            ))}
          </p>
        )}
      </div>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Direcciones guardadas</h2>
          <button onClick={() => setShowAddressForm((v) => !v)} className="text-sm text-pink-700">
            {showAddressForm ? "Cancelar" : "+ Agregar dirección"}
          </button>
        </div>
        {showAddressForm && (
          <form onSubmit={handleAddAddress} className="bg-white border rounded-lg p-3 grid grid-cols-2 gap-2 text-sm">
            <input name="label" required placeholder="Etiqueta (ej. Casa, Oficina)" className="border rounded-md px-2 py-1.5 col-span-2" />
            <input name="recipientName" placeholder="Nombre de quien recibe (si es distinto)" className="border rounded-md px-2 py-1.5" />
            <input name="phone" placeholder="Teléfono de contacto" className="border rounded-md px-2 py-1.5" />
            <input name="address" required placeholder="Dirección" className="border rounded-md px-2 py-1.5 col-span-2" />
            <input name="city" placeholder="Ciudad" className="border rounded-md px-2 py-1.5" />
            <button type="submit" className="bg-pink-600 text-white rounded-md px-3 py-1.5 col-span-2">Guardar dirección</button>
          </form>
        )}
        <div className="bg-white rounded-lg border divide-y">
          {(customer.addresses ?? []).map((a) => (
            <div key={a.id} className="p-3 flex justify-between text-sm">
              <div>
                <p className="font-medium">{a.label} {a.isDefault && <span className="text-xs text-pink-700">(principal)</span>}</p>
                {a.recipientName && <p className="text-gray-500">Recibe: {a.recipientName} {a.phone && `· ${a.phone}`}</p>}
                <p className="text-gray-500">{a.address}{a.city && `, ${a.city}`}</p>
              </div>
              <button onClick={() => handleDeleteAddress(a.id)} className="text-xs text-red-600">Eliminar</button>
            </div>
          ))}
          {(customer.addresses ?? []).length === 0 && <p className="p-3 text-sm text-gray-500">Sin direcciones guardadas.</p>}
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Fechas especiales (recordatorios)</h2>
          <button onClick={() => setShowDateForm((v) => !v)} className="text-sm text-pink-700">
            {showDateForm ? "Cancelar" : "+ Agregar fecha"}
          </button>
        </div>
        {showDateForm && (
          <form onSubmit={handleAddDate} className="bg-white border rounded-lg p-3 grid grid-cols-2 gap-2 text-sm">
            <input name="label" required placeholder="Ej. Cumpleaños de su esposa" className="border rounded-md px-2 py-1.5 col-span-2" />
            <select name="occasion" className="border rounded-md px-2 py-1.5">
              <option value="">Ocasión (opcional)</option>
              {Object.entries(occasionLabel).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <select name="month" required className="border rounded-md px-2 py-1.5 flex-1">
                {monthLabel.map((m, i) => (
                  <option key={m} value={i + 1}>{m}</option>
                ))}
              </select>
              <input name="day" type="number" min="1" max="31" required placeholder="Día" className="border rounded-md px-2 py-1.5 w-20" />
            </div>
            <button type="submit" className="bg-pink-600 text-white rounded-md px-3 py-1.5 col-span-2">Guardar fecha</button>
          </form>
        )}
        <div className="bg-white rounded-lg border divide-y">
          {(customer.specialDates ?? []).map((d) => (
            <div key={d.id} className="p-3 flex justify-between text-sm">
              <div>
                <p className="font-medium">{d.label}</p>
                <p className="text-gray-500">{monthLabel[d.month - 1]} {d.day}{d.occasion && ` · ${occasionLabel[d.occasion]}`}</p>
              </div>
              <button onClick={() => handleDeleteDate(d.id)} className="text-xs text-red-600">Eliminar</button>
            </div>
          ))}
          {(customer.specialDates ?? []).length === 0 && <p className="p-3 text-sm text-gray-500">Sin fechas registradas.</p>}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Historial de pedidos</h2>
        <div className="bg-white rounded-lg border divide-y">
          {(customer.orders ?? []).map((o) => (
            <Link key={o.id} to={`/pedidos/${o.id}`} className="p-3 flex justify-between text-sm hover:bg-pink-50">
              <span className="font-mono">{o.invoiceNumber}</span>
              <span className="text-gray-500">{new Date(o.createdAt).toLocaleDateString()}</span>
              <span>${Number(o.total).toFixed(2)}</span>
            </Link>
          ))}
          {(customer.orders ?? []).length === 0 && <p className="p-3 text-sm text-gray-500">Sin pedidos todavía.</p>}
        </div>
      </section>
    </div>
  );
}
