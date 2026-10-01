import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, Customer, CustomerSpecialDate, Persona } from "../../api/client";
import { useAuth } from "../../context/AuthContext";

const money = (n: number) =>
  Number(n).toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

interface UpcomingSpecialDate extends CustomerSpecialDate {
  daysUntil: number;
  persona: Persona & { customer: Customer };
}

interface ListsResponse {
  relationships?: string[];
  acquisitionChannels?: string[];
  paymentMethods?: string[];
  [key: string]: unknown;
}

interface Suggestion {
  key: string;
  text: string;
  customerId: string;
}

export default function ClientesList() {
  const { can } = useAuth();
  const sensible = can("clientesSensible");

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [upcoming, setUpcoming] = useState<UpcomingSpecialDate[]>([]);
  const [lists, setLists] = useState<ListsResponse>({});
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);

  // Nuevo cliente form state
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [type, setType] = useState<"INDIVIDUAL" | "CORPORATE">("INDIVIDUAL");
  const [documentId, setDocumentId] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [acquisitionChannel, setAcquisitionChannel] = useState("");
  const [tags, setTags] = useState("");
  const [emails, setEmails] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [paymentMethods, setPaymentMethods] = useState<string[]>([]);
  const [addrLabel, setAddrLabel] = useState("");
  const [addrAddress, setAddrAddress] = useState("");
  const [addrCity, setAddrCity] = useState("");
  const [addrZone, setAddrZone] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await api.get<Customer[]>("/customers", { params: search ? { search } : undefined });
    setCustomers(res.data);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => {
    api
      .get<Customer[]>("/customers")
      .then((res) => setAllCustomers(res.data))
      .catch(() => {});
    api
      .get<UpcomingSpecialDate[]>("/customers/special-dates/upcoming", { params: { days: 21 } })
      .then((res) => setUpcoming(res.data))
      .catch(() => {});
    api
      .get<ListsResponse>("/lists")
      .then((res) => setLists(res.data))
      .catch(() => {});
  }, []);

  const suggestions = useMemo<Suggestion[]>(() => {
    const dateSugs: Suggestion[] = upcoming
      .slice()
      .sort((a, b) => a.daysUntil - b.daysUntil)
      .map((d) => ({
        key: `date-${d.id}`,
        text: `${d.persona.name} (${d.label}) — ${d.daysUntil === 0 ? "hoy" : `en ${d.daysUntil} días`}`,
        customerId: d.persona.customer.id,
      }));

    const now = Date.now();
    const inactiveSugs: Suggestion[] = allCustomers
      .filter((c) => c.ordersCount >= 2 && c.lastOrderAt && (now - new Date(c.lastOrderAt).getTime()) / 86400000 > 45)
      .map((c) => ({ c, days: Math.floor((now - new Date(c.lastOrderAt as string).getTime()) / 86400000) }))
      .sort((a, b) => b.days - a.days)
      .map(({ c, days }) => ({
        key: `inactive-${c.id}`,
        text: `${c.name} — posible cliente inactivo, contactar (última compra hace ${days} días)`,
        customerId: c.id,
      }));

    return [...dateSugs, ...inactiveSugs].slice(0, 8);
  }, [upcoming, allCustomers]);

  function resetForm() {
    setName("");
    setPhone("");
    setEmail("");
    setType("INDIVIDUAL");
    setDocumentId("");
    setBirthDate("");
    setAcquisitionChannel("");
    setTags("");
    setEmails([]);
    setNewEmail("");
    setPaymentMethods([]);
    setAddrLabel("");
    setAddrAddress("");
    setAddrCity("");
    setAddrZone("");
  }

  function addEmail() {
    const v = newEmail.trim();
    if (!v) return;
    setEmails((prev) => (prev.includes(v) ? prev : [...prev, v]));
    setNewEmail("");
  }

  function removeEmail(v: string) {
    setEmails((prev) => prev.filter((e) => e !== v));
  }

  function togglePaymentMethod(v: string) {
    setPaymentMethods((prev) => (prev.includes(v) ? prev.filter((m) => m !== v) : [...prev, v]));
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const addresses = addrAddress.trim()
        ? [
            {
              label: addrLabel.trim() || "Principal",
              address: addrAddress.trim(),
              city: addrCity.trim() || undefined,
              zone: addrZone.trim() || undefined,
            },
          ]
        : undefined;
      await api.post("/customers", {
        name,
        phone: phone || undefined,
        email: email || undefined,
        type,
        documentId: documentId || undefined,
        birthDate: birthDate ? new Date(birthDate).toISOString() : undefined,
        acquisitionChannel: acquisitionChannel || undefined,
        tags: tags || undefined,
        emails,
        paymentMethods,
        addresses,
      });
      resetForm();
      setShowForm(false);
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error || "No se pudo crear el cliente");
    }
  }

  const acquisitionChannels = lists.acquisitionChannels ?? [];
  const paymentMethodOptions = lists.paymentMethods ?? [];

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

      {suggestions.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-2">
          <h2 className="text-sm font-semibold text-amber-900">¿A quién debo contactar?</h2>
          <ul className="space-y-1">
            {suggestions.map((s) => (
              <li key={s.key} className="text-sm text-amber-900">
                <Link to={`/clientes/${s.customerId}`} className="hover:underline">
                  {s.text}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

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
              <label className="block text-sm font-medium mb-1">¿Cómo llegó a la floristería?</label>
              {acquisitionChannels.length > 0 ? (
                <select
                  value={acquisitionChannel}
                  onChange={(e) => setAcquisitionChannel(e.target.value)}
                  className="w-full border rounded-md px-3 py-2"
                >
                  <option value="">Sin especificar</option>
                  {acquisitionChannels.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  value={acquisitionChannel}
                  onChange={(e) => setAcquisitionChannel(e.target.value)}
                  className="w-full border rounded-md px-3 py-2"
                />
              )}
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
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Emails adicionales</label>
            <div className="flex gap-2">
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="correo@ejemplo.com"
                className="flex-1 border rounded-md px-3 py-2"
              />
              <button
                type="button"
                onClick={addEmail}
                className="bg-gray-100 text-sm rounded-md px-3 py-2 border"
              >
                Agregar
              </button>
            </div>
            {emails.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {emails.map((em) => (
                  <span key={em} className="bg-pink-50 text-pink-700 text-xs px-2 py-1 rounded flex items-center gap-1">
                    {em}
                    <button type="button" onClick={() => removeEmail(em)} className="text-pink-700 font-bold">
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {paymentMethodOptions.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-1">Métodos de pago</label>
              <div className="flex flex-wrap gap-3">
                {paymentMethodOptions.map((m) => (
                  <label key={m} className="flex items-center gap-1 text-sm">
                    <input
                      type="checkbox"
                      checked={paymentMethods.includes(m)}
                      onChange={() => togglePaymentMethod(m)}
                    />
                    {m}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="border-t pt-3">
            <p className="text-sm font-medium mb-2">Dirección inicial (opcional)</p>
            <div className="grid grid-cols-2 gap-2">
              <input
                placeholder="Etiqueta (ej. Casa)"
                value={addrLabel}
                onChange={(e) => setAddrLabel(e.target.value)}
                className="border rounded-md px-2 py-1.5 text-sm"
              />
              <input
                placeholder="Ciudad"
                value={addrCity}
                onChange={(e) => setAddrCity(e.target.value)}
                className="border rounded-md px-2 py-1.5 text-sm"
              />
              <input
                placeholder="Dirección"
                value={addrAddress}
                onChange={(e) => setAddrAddress(e.target.value)}
                className="border rounded-md px-2 py-1.5 text-sm col-span-2"
              />
              <input
                placeholder="Zona (ej. Norte, Sur)"
                value={addrZone}
                onChange={(e) => setAddrZone(e.target.value)}
                className="border rounded-md px-2 py-1.5 text-sm"
              />
            </div>
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
          {sensible && <span className="w-36">Documento</span>}
          {sensible && <span className="w-28 text-right">Valor total</span>}
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
            <span className="w-32 text-gray-500">{c.phone || "—"}</span>
            {sensible && <span className="w-36 text-gray-500">{c.documentId || "—"}</span>}
            {sensible && <span className="w-28 sm:text-right text-gray-500">{money(Number(c.lifetimeValue))}</span>}
          </Link>
        ))}
        {customers.length === 0 && <p className="p-4 text-sm text-gray-500">Sin clientes todavía.</p>}
      </div>
    </div>
  );
}
