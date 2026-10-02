import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, Customer, CustomerSpecialDate, Persona } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import ZoneField from "../../components/ZoneField";
import SortHeader, { compareValues, SortDir, toggleSort } from "../../components/SortHeader";

type CustomerSortKey = "name" | "phone" | "documentId" | "lifetimeValue";

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

interface AddressDraft {
  label: string;
  address: string;
  city: string;
  zone: string;
}

interface SpecialDateDraft {
  label: string;
  month: number;
  day: number;
}

const money = (n: number) =>
  Number(n).toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

interface SpecialDateSuggestion extends CustomerSpecialDate {
  daysUntil: number;
  persona: Persona & { customer: Customer };
}

interface HabitSuggestion {
  customer: Customer;
  daysSinceLast: number;
  avgIntervalDays: number;
}

interface ContactSuggestions {
  specialDates: SpecialDateSuggestion[];
  habitual: HabitSuggestion[];
}

interface ListsResponse {
  relationships?: string[];
  acquisitionChannels?: string[];
  paymentMethods?: string[];
  [key: string]: unknown;
}

function waHref(phone: string | null, text: string): string {
  const digits = (phone ?? "").replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export default function ClientesList() {
  const { can } = useAuth();
  const sensible = can("clientesSensible");

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suggestions, setSuggestions] = useState<ContactSuggestions>({ specialDates: [], habitual: [] });
  const [lists, setLists] = useState<ListsResponse>({});
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [sortKey, setSortKey] = useState<CustomerSortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function onSort(key: CustomerSortKey) {
    toggleSort(key, sortKey, sortDir, setSortKey, setSortDir);
  }

  const visibleCustomers = useMemo(() => {
    if (!sortKey) return customers;
    const numeric = sortKey === "lifetimeValue";
    return [...customers].sort((a, b) => {
      const cmp = numeric ? Number(a[sortKey]) - Number(b[sortKey]) : compareValues(a[sortKey], b[sortKey]);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [customers, sortKey, sortDir]);

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
  const [addresses, setAddresses] = useState<AddressDraft[]>([]);
  const [addrLabel, setAddrLabel] = useState("");
  const [addrAddress, setAddrAddress] = useState("");
  const [addrCity, setAddrCity] = useState("");
  const [addrZone, setAddrZone] = useState("");
  const [specialDates, setSpecialDates] = useState<SpecialDateDraft[]>([]);
  const [sdLabel, setSdLabel] = useState("");
  const [sdMonth, setSdMonth] = useState(1);
  const [sdDay, setSdDay] = useState(1);
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
      .get<ContactSuggestions>("/customers/contact-suggestions", { params: { days: 21 } })
      .then((res) => setSuggestions(res.data))
      .catch(() => {});
    api
      .get<ListsResponse>("/lists")
      .then((res) => setLists(res.data))
      .catch(() => {});
  }, []);

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
    setAddresses([]);
    setAddrLabel("");
    setAddrAddress("");
    setAddrCity("");
    setAddrZone("");
    setSpecialDates([]);
    setSdLabel("");
    setSdMonth(1);
    setSdDay(1);
  }

  function addAddress() {
    if (!addrAddress.trim()) return;
    setAddresses((prev) => [
      ...prev,
      { label: addrLabel.trim() || "Principal", address: addrAddress.trim(), city: addrCity.trim(), zone: addrZone },
    ]);
    setAddrLabel("");
    setAddrAddress("");
    setAddrCity("");
    setAddrZone("");
  }

  function removeAddress(idx: number) {
    setAddresses((prev) => prev.filter((_, i) => i !== idx));
  }

  function addSpecialDate() {
    if (!sdLabel.trim()) return;
    setSpecialDates((prev) => [...prev, { label: sdLabel.trim(), month: sdMonth, day: sdDay }]);
    setSdLabel("");
    setSdMonth(1);
    setSdDay(1);
  }

  function removeSpecialDate(idx: number) {
    setSpecialDates((prev) => prev.filter((_, i) => i !== idx));
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
      const allAddresses = [
        ...addresses,
        ...(addrAddress.trim()
          ? [{ label: addrLabel.trim() || "Principal", address: addrAddress.trim(), city: addrCity.trim(), zone: addrZone }]
          : []),
      ].map((a, idx) => ({
        label: a.label,
        address: a.address,
        city: a.city || undefined,
        zone: a.zone || undefined,
        isDefault: idx === 0,
      }));
      const allSpecialDates = [
        ...specialDates,
        ...(sdLabel.trim() ? [{ label: sdLabel.trim(), month: sdMonth, day: sdDay }] : []),
      ];
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
        addresses: allAddresses.length ? allAddresses : undefined,
        specialDates: allSpecialDates.length ? allSpecialDates : undefined,
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

      {(suggestions.specialDates.length > 0 || suggestions.habitual.length > 0) && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
          <h2 className="text-sm font-semibold text-amber-900">¿A quién debo contactar?</h2>

          {suggestions.specialDates.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-amber-800 uppercase">Fechas especiales próximas</p>
              <ul className="space-y-1.5">
                {suggestions.specialDates.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-2 text-sm text-amber-900">
                    <Link to={`/clientes/${d.persona.customer.id}`} className="hover:underline">
                      {d.persona.name} ({d.label}) — {d.daysUntil === 0 ? "hoy" : `en ${d.daysUntil} días`}
                    </Link>
                    <span className="flex gap-1 shrink-0">
                      <a
                        href={waHref(
                          d.persona.customer.phone,
                          `¡Hola ${d.persona.name}! Queremos recordarte que se acerca ${d.label.toLowerCase()} 🌸 ¿Te ayudamos con un detalle especial?`
                        )}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs border border-amber-300 rounded-md px-2 py-1 hover:bg-amber-100"
                      >
                        Contactar
                      </a>
                      <Link
                        to={`/pedidos/nuevo?customerId=${d.persona.customer.id}`}
                        className="text-xs border border-amber-300 rounded-md px-2 py-1 hover:bg-amber-100"
                      >
                        Pedido
                      </Link>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {suggestions.habitual.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-amber-800 uppercase">Según su hábito de compra</p>
              <ul className="space-y-1.5">
                {suggestions.habitual.map((h) => (
                  <li key={h.customer.id} className="flex items-center justify-between gap-2 text-sm text-amber-900">
                    <Link to={`/clientes/${h.customer.id}`} className="hover:underline flex items-center gap-2">
                      {h.customer.name} — suele comprar cada {h.avgIntervalDays} días, última compra hace {h.daysSinceLast} días
                      <span className="text-xs bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded">Inactivo</span>
                    </Link>
                    <span className="flex gap-1 shrink-0">
                      <a
                        href={waHref(
                          h.customer.phone,
                          `¡Hola ${h.customer.name}! Hace tiempo no te enviamos flores 🌸 ¿Te gustaría hacer un pedido?`
                        )}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs border border-amber-300 rounded-md px-2 py-1 hover:bg-amber-100"
                      >
                        Contactar
                      </a>
                      <Link
                        to={`/pedidos/nuevo?customerId=${h.customer.id}`}
                        className="text-xs border border-amber-300 rounded-md px-2 py-1 hover:bg-amber-100"
                      >
                        Pedido
                      </Link>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
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
            <p className="text-sm font-medium mb-2">Direcciones (opcional)</p>
            {addresses.length > 0 && (
              <ul className="space-y-1 mb-2">
                {addresses.map((a, idx) => (
                  <li key={idx} className="flex items-center justify-between text-sm bg-gray-50 border rounded-md px-2 py-1.5">
                    <span>
                      <strong>{a.label}:</strong> {a.address}
                      {a.city ? `, ${a.city}` : ""}
                      {a.zone ? ` (${a.zone})` : ""}
                      {idx === 0 && addresses.length > 0 && <span className="ml-1 text-xs text-gray-500">— predeterminada</span>}
                    </span>
                    <button type="button" onClick={() => removeAddress(idx)} className="text-red-600 text-xs">
                      Quitar
                    </button>
                  </li>
                ))}
              </ul>
            )}
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
              <ZoneField
                zone={addrZone}
                onZoneChange={setAddrZone}
                address={addrAddress}
                className="border rounded-md px-2 py-1.5 text-sm"
              />
              <button
                type="button"
                onClick={addAddress}
                className="bg-gray-100 text-sm rounded-md px-3 py-1.5 border"
              >
                + Agregar otra dirección
              </button>
            </div>
          </div>

          <div className="border-t pt-3">
            <p className="text-sm font-medium mb-2">Fechas especiales (opcional)</p>
            {specialDates.length > 0 && (
              <ul className="space-y-1 mb-2">
                {specialDates.map((d, idx) => (
                  <li key={idx} className="flex items-center justify-between text-sm bg-gray-50 border rounded-md px-2 py-1.5">
                    <span>
                      {d.label} — {MONTHS[d.month - 1]} {d.day}
                    </span>
                    <button type="button" onClick={() => removeSpecialDate(idx)} className="text-red-600 text-xs">
                      Quitar
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="grid grid-cols-3 gap-2">
              <input
                placeholder="Ej. Cumpleaños"
                value={sdLabel}
                onChange={(e) => setSdLabel(e.target.value)}
                className="border rounded-md px-2 py-1.5 text-sm col-span-2"
              />
              <select
                value={sdMonth}
                onChange={(e) => setSdMonth(Number(e.target.value))}
                className="border rounded-md px-2 py-1.5 text-sm"
              >
                {MONTHS.map((m, idx) => (
                  <option key={m} value={idx + 1}>
                    {m}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={1}
                max={31}
                placeholder="Día"
                value={sdDay}
                onChange={(e) => setSdDay(Number(e.target.value))}
                className="border rounded-md px-2 py-1.5 text-sm"
              />
              <button
                type="button"
                onClick={addSpecialDate}
                className="bg-gray-100 text-sm rounded-md px-3 py-1.5 border col-span-2"
              >
                + Agregar fecha
              </button>
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
          <span className="flex-1"><SortHeader label="Nombre" sortKey="name" active={sortKey} dir={sortDir} onClick={onSort} /></span>
          <span className="w-32"><SortHeader label="Teléfono" sortKey="phone" active={sortKey} dir={sortDir} onClick={onSort} /></span>
          {sensible && <span className="w-36"><SortHeader label="Documento" sortKey="documentId" active={sortKey} dir={sortDir} onClick={onSort} /></span>}
          {sensible && <span className="w-28 text-right"><SortHeader label="Valor total" sortKey="lifetimeValue" active={sortKey} dir={sortDir} onClick={onSort} className="justify-end" /></span>}
        </div>
        {visibleCustomers.map((c) => (
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
        {visibleCustomers.length === 0 && <p className="p-4 text-sm text-gray-500">Sin clientes todavía.</p>}
      </div>
    </div>
  );
}
