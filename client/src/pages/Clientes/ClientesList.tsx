import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, Customer } from "../../api/client";
import { channelLabel } from "../../lib/labels";

export default function ClientesList() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [type, setType] = useState<"INDIVIDUAL" | "CORPORATE">("INDIVIDUAL");
  const [documentId, setDocumentId] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [preferredContact, setPreferredContact] = useState("");
  const [acquisitionChannel, setAcquisitionChannel] = useState("");
  const [tags, setTags] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await api.get<Customer[]>("/customers", { params: search ? { search } : undefined });
    setCustomers(res.data);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function resetForm() {
    setName("");
    setPhone("");
    setEmail("");
    setType("INDIVIDUAL");
    setDocumentId("");
    setBirthDate("");
    setPreferredContact("");
    setAcquisitionChannel("");
    setTags("");
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post("/customers", {
        name,
        phone,
        email,
        type,
        documentId: documentId || undefined,
        birthDate: birthDate ? new Date(birthDate).toISOString() : undefined,
        preferredContact: preferredContact || undefined,
        acquisitionChannel: acquisitionChannel || undefined,
        tags: tags || undefined,
      });
      resetForm();
      setShowForm(false);
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error || "No se pudo crear el cliente");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Clientes</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="bg-pink-600 text-white text-sm rounded-md px-3 py-2"
        >
          {showForm ? "Cancelar" : "Nuevo cliente"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white p-4 rounded-lg border space-y-3 max-w-2xl">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Nombre</label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border rounded-md px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Tipo de cliente</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as "INDIVIDUAL" | "CORPORATE")}
                className="w-full border rounded-md px-3 py-2"
              >
                <option value="INDIVIDUAL">Persona natural</option>
                <option value="CORPORATE">Empresa</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Teléfono</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full border rounded-md px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border rounded-md px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                {type === "CORPORATE" ? "NIT" : "Documento de identidad"}
              </label>
              <input
                value={documentId}
                onChange={(e) => setDocumentId(e.target.value)}
                className="w-full border rounded-md px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Fecha de nacimiento</label>
              <input
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                className="w-full border rounded-md px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Contacto preferido</label>
              <select
                value={preferredContact}
                onChange={(e) => setPreferredContact(e.target.value)}
                className="w-full border rounded-md px-3 py-2"
              >
                <option value="">Sin especificar</option>
                {Object.entries(channelLabel).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">¿Cómo llegó a la floristería?</label>
              <select
                value={acquisitionChannel}
                onChange={(e) => setAcquisitionChannel(e.target.value)}
                className="w-full border rounded-md px-3 py-2"
              >
                <option value="">Sin especificar</option>
                {Object.entries(channelLabel).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Etiquetas (separadas por coma)</label>
            <input
              placeholder="vip, corporativo, frecuente..."
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="w-full border rounded-md px-3 py-2"
            />
          </div>
          <button type="submit" className="bg-pink-600 text-white rounded-md px-4 py-2 text-sm">
            Guardar
          </button>
        </form>
      )}

      <input
        placeholder="Buscar por nombre o teléfono..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full max-w-md border rounded-md px-3 py-2"
      />

      <div className="bg-white rounded-lg border divide-y">
        <div className="p-3 hidden sm:flex text-xs font-semibold text-gray-500 uppercase">
          <span className="flex-1">Nombre</span>
          <span className="w-32">Teléfono</span>
          <span className="w-24 text-right">Pedidos</span>
          <span className="w-28 text-right">Valor total</span>
          <span className="w-32 text-right">Última compra</span>
        </div>
        {customers.map((c) => (
          <Link
            key={c.id}
            to={`/clientes/${c.id}`}
            className="p-3 flex flex-col sm:flex-row sm:items-center text-sm hover:bg-pink-50"
          >
            <span className="flex-1 font-medium">
              {c.name}
              {c.type === "CORPORATE" && (
                <span className="ml-2 text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">Empresa</span>
              )}
            </span>
            <span className="w-32 text-gray-500">{c.phone}</span>
            <span className="w-24 sm:text-right text-gray-500">{c.ordersCount}</span>
            <span className="w-28 sm:text-right text-gray-500">${Number(c.lifetimeValue).toFixed(2)}</span>
            <span className="w-32 sm:text-right text-gray-500">
              {c.lastOrderAt ? new Date(c.lastOrderAt).toLocaleDateString() : "—"}
            </span>
          </Link>
        ))}
        {customers.length === 0 && <p className="p-4 text-sm text-gray-500">Sin clientes todavía.</p>}
      </div>
    </div>
  );
}
