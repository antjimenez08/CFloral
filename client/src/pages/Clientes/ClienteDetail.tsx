import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, Customer, CustomerAddress, Persona } from "../../api/client";
import { STATUS_LABEL } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { monthLabel } from "../../lib/labels";
import { ZONES, guessZoneFromAddress } from "../Despachos/zoneUtils";

const money = (n: number) =>
  Number(n).toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

function Stars({ value }: { value: number }) {
  const rounded = Math.round(value);
  return (
    <span className="text-amber-500 text-sm" title={`${value.toFixed(1)} / 5`}>
      {"★".repeat(rounded)}
      <span className="text-gray-300">{"★".repeat(5 - rounded)}</span>
    </span>
  );
}

interface ListsResponse {
  relationships?: string[];
  acquisitionChannels?: string[];
  paymentMethods?: string[];
  [key: string]: unknown;
}

type Tab = "perfil" | "personas" | "historico";

export default function ClienteDetail() {
  const { id } = useParams();
  const { can } = useAuth();
  const sensible = can("clientesSensible");

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [lists, setLists] = useState<ListsResponse>({});
  const [tab, setTab] = useState<Tab>("perfil");
  const [error, setError] = useState<string | null>(null);

  // --- Perfil edit state ---
  const [pName, setPName] = useState("");
  const [pPhone, setPPhone] = useState("");
  const [pEmail, setPEmail] = useState("");
  const [pType, setPType] = useState<"INDIVIDUAL" | "CORPORATE">("INDIVIDUAL");
  const [pBirthDate, setPBirthDate] = useState("");
  const [pDocumentId, setPDocumentId] = useState("");
  const [pAcquisitionChannel, setPAcquisitionChannel] = useState("");
  const [pTags, setPTags] = useState("");
  const [pEmails, setPEmails] = useState<string[]>([]);
  const [pNewEmail, setPNewEmail] = useState("");
  const [pPaymentMethods, setPPaymentMethods] = useState<string[]>([]);
  const [savingProfile, setSavingProfile] = useState(false);

  // --- Personas tab state ---
  const [showPersonaForm, setShowPersonaForm] = useState(false);
  const [personaName, setPersonaName] = useState("");
  const [personaRelationship, setPersonaRelationship] = useState("");
  const [personaPhone, setPersonaPhone] = useState("");
  const [addressFormFor, setAddressFormFor] = useState<string | null>(null);
  const [dateFormFor, setDateFormFor] = useState<string | null>(null);

  async function load() {
    const res = await api.get<Customer>(`/customers/${id}`);
    setCustomer(res.data);
    setPName(res.data.name);
    setPPhone(res.data.phone || "");
    setPEmail(res.data.email || "");
    setPType(res.data.type);
    setPBirthDate(res.data.birthDate ? res.data.birthDate.slice(0, 10) : "");
    setPDocumentId(res.data.documentId || "");
    setPAcquisitionChannel(res.data.acquisitionChannel || "");
    setPTags(res.data.tags || "");
    setPEmails(res.data.emails || []);
    setPPaymentMethods(res.data.paymentMethods || []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    api
      .get<ListsResponse>("/lists")
      .then((res) => setLists(res.data))
      .catch(() => {});
  }, []);

  const personas = useMemo(() => customer?.personas ?? [], [customer]);
  const orders = useMemo(() => customer?.orders ?? [], [customer]);
  const avgRating = useMemo(() => {
    const rated = orders.filter((o) => o.rating != null);
    if (rated.length === 0) return null;
    return rated.reduce((sum, o) => sum + (o.rating || 0), 0) / rated.length;
  }, [orders]);

  function addProfileEmail() {
    const v = pNewEmail.trim();
    if (!v) return;
    setPEmails((prev) => (prev.includes(v) ? prev : [...prev, v]));
    setPNewEmail("");
  }

  function removeProfileEmail(v: string) {
    setPEmails((prev) => prev.filter((e) => e !== v));
  }

  function toggleProfilePaymentMethod(v: string) {
    setPPaymentMethods((prev) => (prev.includes(v) ? prev.filter((m) => m !== v) : [...prev, v]));
  }

  async function handleSaveProfile(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    setError(null);
    setSavingProfile(true);
    try {
      await api.put(`/customers/${id}`, {
        name: pName,
        phone: pPhone || undefined,
        email: pEmail || undefined,
        type: pType,
        birthDate: pBirthDate ? new Date(pBirthDate).toISOString() : null,
        documentId: pDocumentId || undefined,
        acquisitionChannel: pAcquisitionChannel || undefined,
        tags: pTags || undefined,
        emails: pEmails,
        paymentMethods: pPaymentMethods,
      });
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error || "No se pudo guardar el perfil");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleAddPersona(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    setError(null);
    try {
      await api.post(`/customers/${id}/personas`, {
        name: personaName,
        relationship: personaRelationship || "Otro",
        phone: personaPhone || undefined,
      });
      setPersonaName("");
      setPersonaRelationship("");
      setPersonaPhone("");
      setShowPersonaForm(false);
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error || "No se pudo agregar la persona");
    }
  }

  async function handleDeletePersona(persona: Persona) {
    if (persona.isTitular) return;
    await api.delete(`/customers/personas/${persona.id}`);
    load();
  }

  async function handleAddAddress(personaId: string, e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    try {
      await api.post(`/customers/personas/${personaId}/addresses`, {
        label: form.get("label"),
        recipientName: form.get("recipientName") || undefined,
        phone: form.get("phone") || undefined,
        address: form.get("address"),
        city: form.get("city") || undefined,
        zone: form.get("zone") || undefined,
      });
      setAddressFormFor(null);
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error || "No se pudo agregar la dirección");
    }
  }

  async function handleDeleteAddress(personaId: string, addressId: string) {
    await api.delete(`/customers/personas/${personaId}/addresses/${addressId}`);
    load();
  }

  async function handleSetDefaultAddress(persona: Persona, address: CustomerAddress) {
    if (address.isDefault) return;
    const prevDefault = (persona.addresses ?? []).find((a) => a.isDefault && a.id !== address.id);
    try {
      if (prevDefault) {
        await api.put(`/customers/personas/${persona.id}/addresses/${prevDefault.id}`, { isDefault: false });
      }
      await api.put(`/customers/personas/${persona.id}/addresses/${address.id}`, { isDefault: true });
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error || "No se pudo marcar como principal");
    }
  }

  async function handleAddSpecialDate(personaId: string, e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    try {
      await api.post(`/customers/personas/${personaId}/special-dates`, {
        label: form.get("label"),
        month: Number(form.get("month")),
        day: Number(form.get("day")),
        notes: form.get("notes") || undefined,
      });
      setDateFormFor(null);
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error || "No se pudo agregar la fecha");
    }
  }

  async function handleDeleteSpecialDate(personaId: string, dateId: string) {
    await api.delete(`/customers/personas/${personaId}/special-dates/${dateId}`);
    load();
  }

  if (!customer) return <p className="text-sm text-gray-500">Cargando...</p>;

  const relationships = lists.relationships ?? [];
  const acquisitionChannels = lists.acquisitionChannels ?? [];
  const paymentMethodOptions = lists.paymentMethods ?? [];

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between">
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
          <p className="text-sm text-gray-500">
            {customer.phone} {customer.email && `· ${customer.email}`}
          </p>
        </div>
        <Link
          to={`/pedidos/nuevo?customerId=${customer.id}`}
          className="bg-pink-600 text-white text-sm rounded-md px-3 py-2 whitespace-nowrap"
        >
          + Nuevo pedido
        </Link>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-1 border-b">
        {([
          ["perfil", "Perfil"],
          ["personas", "Personas"],
          ["historico", "Histórico"],
        ] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === key ? "border-pink-600 text-pink-700" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "perfil" && (
        <form onSubmit={handleSaveProfile} className="bg-white rounded-lg border p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Nombre</label>
              <input
                required
                value={pName}
                onChange={(e) => setPName(e.target.value)}
                className="w-full border rounded-md px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Teléfono</label>
              <input
                value={pPhone}
                onChange={(e) => setPPhone(e.target.value)}
                className="w-full border rounded-md px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email principal</label>
              <input
                type="email"
                value={pEmail}
                onChange={(e) => setPEmail(e.target.value)}
                className="w-full border rounded-md px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Tipo de cliente</label>
              <select
                value={pType}
                onChange={(e) => setPType(e.target.value as "INDIVIDUAL" | "CORPORATE")}
                className="w-full border rounded-md px-3 py-2"
              >
                <option value="INDIVIDUAL">Persona natural</option>
                <option value="CORPORATE">Empresa</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Fecha de nacimiento</label>
              <input
                type="date"
                value={pBirthDate}
                onChange={(e) => setPBirthDate(e.target.value)}
                className="w-full border rounded-md px-3 py-2"
              />
            </div>
            {sensible && (
              <div>
                <label className="block text-sm font-medium mb-1">Documento</label>
                <input
                  value={pDocumentId}
                  onChange={(e) => setPDocumentId(e.target.value)}
                  className="w-full border rounded-md px-3 py-2"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium mb-1">¿Cómo llegó a la floristería?</label>
              {acquisitionChannels.length > 0 ? (
                <select
                  value={pAcquisitionChannel}
                  onChange={(e) => setPAcquisitionChannel(e.target.value)}
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
                  value={pAcquisitionChannel}
                  onChange={(e) => setPAcquisitionChannel(e.target.value)}
                  className="w-full border rounded-md px-3 py-2"
                />
              )}
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1">Etiquetas (separadas por coma)</label>
              <input
                value={pTags}
                onChange={(e) => setPTags(e.target.value)}
                className="w-full border rounded-md px-3 py-2"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Emails</label>
            <div className="flex gap-2">
              <input
                type="email"
                value={pNewEmail}
                onChange={(e) => setPNewEmail(e.target.value)}
                placeholder="correo@ejemplo.com"
                className="flex-1 border rounded-md px-3 py-2"
              />
              <button type="button" onClick={addProfileEmail} className="bg-gray-100 text-sm rounded-md px-3 py-2 border">
                Agregar
              </button>
            </div>
            {pEmails.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {pEmails.map((em) => (
                  <span key={em} className="bg-pink-50 text-pink-700 text-xs px-2 py-1 rounded flex items-center gap-1">
                    {em}
                    <button type="button" onClick={() => removeProfileEmail(em)} className="text-pink-700 font-bold">
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
                      checked={pPaymentMethods.includes(m)}
                      onChange={() => toggleProfilePaymentMethod(m)}
                    />
                    {m}
                  </label>
                ))}
              </div>
            </div>
          )}

          <button type="submit" disabled={savingProfile} className="bg-pink-600 text-white rounded-md px-4 py-2 text-sm disabled:opacity-50">
            {savingProfile ? "Guardando..." : "Guardar"}
          </button>
        </form>
      )}

      {tab === "personas" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Personas</h2>
            <button onClick={() => setShowPersonaForm((v) => !v)} className="text-sm text-pink-700">
              {showPersonaForm ? "Cancelar" : "+ Nueva persona"}
            </button>
          </div>

          {showPersonaForm && (
            <form onSubmit={handleAddPersona} className="bg-white border rounded-lg p-3 grid grid-cols-2 gap-2 text-sm">
              <input
                required
                placeholder="Nombre"
                value={personaName}
                onChange={(e) => setPersonaName(e.target.value)}
                className="border rounded-md px-2 py-1.5 col-span-2"
              />
              {relationships.length > 0 ? (
                <select
                  value={personaRelationship}
                  onChange={(e) => setPersonaRelationship(e.target.value)}
                  className="border rounded-md px-2 py-1.5"
                >
                  <option value="">Relación...</option>
                  {relationships
                    .filter((r) => r !== "Titular")
                    .map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                </select>
              ) : (
                <input
                  placeholder="Relación (ej. Esposo/a, Hijo/a)"
                  value={personaRelationship}
                  onChange={(e) => setPersonaRelationship(e.target.value)}
                  className="border rounded-md px-2 py-1.5"
                />
              )}
              <input
                placeholder="Teléfono"
                value={personaPhone}
                onChange={(e) => setPersonaPhone(e.target.value)}
                className="border rounded-md px-2 py-1.5"
              />
              <button type="submit" className="bg-pink-600 text-white rounded-md px-3 py-1.5 col-span-2">
                Guardar persona
              </button>
            </form>
          )}

          {personas.map((persona) => (
            <div key={persona.id} className="bg-white rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <p className="font-medium">
                    {persona.name} {persona.isTitular && <span className="text-xs text-pink-700">(titular)</span>}
                  </p>
                  <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{persona.relationship}</span>
                </div>
                {!persona.isTitular && (
                  <button onClick={() => handleDeletePersona(persona)} className="text-xs text-red-600">
                    Eliminar persona
                  </button>
                )}
              </div>
              {persona.phone && <p className="text-sm text-gray-500">{persona.phone}</p>}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-700">Direcciones</p>
                  <button
                    onClick={() => setAddressFormFor(addressFormFor === persona.id ? null : persona.id)}
                    className="text-xs text-pink-700"
                  >
                    {addressFormFor === persona.id ? "Cancelar" : "+ Agregar dirección"}
                  </button>
                </div>
                {addressFormFor === persona.id && (
                  <form
                    onSubmit={(e) => handleAddAddress(persona.id, e)}
                    className="border rounded-lg p-3 grid grid-cols-2 gap-2 text-sm"
                  >
                    <input name="label" required placeholder="Etiqueta (ej. Casa, Oficina)" className="border rounded-md px-2 py-1.5 col-span-2" />
                    <input name="recipientName" placeholder="Nombre de quien recibe (si es distinto)" className="border rounded-md px-2 py-1.5" />
                    <input name="phone" placeholder="Teléfono de contacto" className="border rounded-md px-2 py-1.5" />
                    <input
                      name="address"
                      required
                      placeholder="Dirección"
                      className="border rounded-md px-2 py-1.5 col-span-2"
                      onChange={(e) => {
                        const zoneSelect = e.currentTarget.form?.elements.namedItem("zone") as HTMLSelectElement | null;
                        if (zoneSelect && !zoneSelect.dataset.touched) zoneSelect.value = guessZoneFromAddress(e.target.value);
                      }}
                    />
                    <input name="city" placeholder="Ciudad" className="border rounded-md px-2 py-1.5" />
                    <select name="zone" defaultValue="" className="border rounded-md px-2 py-1.5" onChange={(e) => { e.currentTarget.dataset.touched = "1"; }}>
                      <option value="">Zona (sin definir)</option>
                      {ZONES.map((z) => <option key={z} value={z}>{z}</option>)}
                    </select>
                    <button type="submit" className="bg-pink-600 text-white rounded-md px-3 py-1.5 col-span-2">
                      Guardar dirección
                    </button>
                  </form>
                )}
                <div className="border rounded-lg divide-y">
                  {(persona.addresses ?? []).map((a) => (
                    <div key={a.id} className="p-2.5 flex items-start justify-between text-sm">
                      <div className="flex items-start gap-2">
                        <button
                          type="button"
                          title={a.isDefault ? "Dirección principal" : "Marcar como principal"}
                          onClick={() => handleSetDefaultAddress(persona, a)}
                          className={a.isDefault ? "text-amber-500" : "text-gray-300 hover:text-amber-400"}
                        >
                          ★
                        </button>
                        <div>
                          <p className="font-medium">
                            {a.label} {a.zone && <span className="text-xs text-gray-500">· {a.zone}</span>}
                          </p>
                          {a.recipientName && (
                            <p className="text-gray-500">
                              Recibe: {a.recipientName} {a.phone && `· ${a.phone}`}
                            </p>
                          )}
                          <p className="text-gray-500">
                            {a.address}
                            {a.city && `, ${a.city}`}
                          </p>
                        </div>
                      </div>
                      <button onClick={() => handleDeleteAddress(persona.id, a.id)} className="text-xs text-red-600">
                        Eliminar
                      </button>
                    </div>
                  ))}
                  {(persona.addresses ?? []).length === 0 && (
                    <p className="p-2.5 text-sm text-gray-500">Sin direcciones guardadas.</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-700">Fechas especiales</p>
                  <button
                    onClick={() => setDateFormFor(dateFormFor === persona.id ? null : persona.id)}
                    className="text-xs text-pink-700"
                  >
                    {dateFormFor === persona.id ? "Cancelar" : "+ Agregar fecha"}
                  </button>
                </div>
                {dateFormFor === persona.id && (
                  <form
                    onSubmit={(e) => handleAddSpecialDate(persona.id, e)}
                    className="border rounded-lg p-3 grid grid-cols-2 gap-2 text-sm"
                  >
                    <input name="label" required placeholder="Ej. Cumpleaños" className="border rounded-md px-2 py-1.5 col-span-2" />
                    <div className="flex gap-2 col-span-2">
                      <select name="month" required className="border rounded-md px-2 py-1.5 flex-1">
                        {monthLabel.map((m, i) => (
                          <option key={m} value={i + 1}>
                            {m}
                          </option>
                        ))}
                      </select>
                      <input name="day" type="number" min="1" max="31" required placeholder="Día" className="border rounded-md px-2 py-1.5 w-20" />
                    </div>
                    <input name="notes" placeholder="Notas (opcional)" className="border rounded-md px-2 py-1.5 col-span-2" />
                    <button type="submit" className="bg-pink-600 text-white rounded-md px-3 py-1.5 col-span-2">
                      Guardar fecha
                    </button>
                  </form>
                )}
                <div className="border rounded-lg divide-y">
                  {(persona.specialDates ?? []).map((d) => (
                    <div key={d.id} className="p-2.5 flex justify-between text-sm">
                      <div>
                        <p className="font-medium">{d.label}</p>
                        <p className="text-gray-500">
                          {monthLabel[d.month - 1]} {d.day}
                          {d.notes && ` · ${d.notes}`}
                        </p>
                      </div>
                      <button onClick={() => handleDeleteSpecialDate(persona.id, d.id)} className="text-xs text-red-600">
                        Eliminar
                      </button>
                    </div>
                  ))}
                  {(persona.specialDates ?? []).length === 0 && (
                    <p className="p-2.5 text-sm text-gray-500">Sin fechas registradas.</p>
                  )}
                </div>
              </div>
            </div>
          ))}
          {personas.length === 0 && <p className="text-sm text-gray-500">Sin personas registradas.</p>}
        </div>
      )}

      {tab === "historico" && (
        <div className="space-y-4">
          <div className={`grid gap-3 ${sensible ? "grid-cols-3" : "grid-cols-2"}`}>
            <div className="bg-white rounded-lg border p-3 text-center">
              <p className="text-xs text-gray-500 uppercase">Pedidos</p>
              <p className="text-lg font-semibold">{customer.ordersCount}</p>
            </div>
            {sensible && (
              <div className="bg-white rounded-lg border p-3 text-center">
                <p className="text-xs text-gray-500 uppercase">Valor total</p>
                <p className="text-lg font-semibold">{money(Number(customer.lifetimeValue))}</p>
              </div>
            )}
            <div className="bg-white rounded-lg border p-3 text-center">
              <p className="text-xs text-gray-500 uppercase">Calificación promedio</p>
              <p className="text-lg font-semibold">
                {avgRating != null ? <Stars value={avgRating} /> : "—"}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-lg border divide-y">
            <div className="p-3 hidden sm:flex text-xs font-semibold text-gray-500 uppercase">
              <span className="flex-1">Factura</span>
              <span className="w-32">Fecha</span>
              <span className="w-32">Estado</span>
              <span className="w-24">Calificación</span>
              <span className="w-24 text-right">Total</span>
              <span className="w-28 text-right">Acción</span>
            </div>
            {orders.map((o) => (
              <div key={o.id} className="p-3 flex flex-col sm:flex-row sm:items-center text-sm hover:bg-pink-50 gap-1">
                <Link to={`/pedidos/${o.id}`} className="flex-1 font-mono hover:underline">
                  {o.invoiceNumber}
                </Link>
                <span className="w-32 text-gray-500">{new Date(o.createdAt).toLocaleDateString()}</span>
                <span className="w-32 text-gray-500">{STATUS_LABEL[o.status] ?? o.status}</span>
                <span className="w-24">{o.rating != null ? <Stars value={o.rating} /> : "—"}</span>
                <span className="w-24 sm:text-right">{money(Number(o.total))}</span>
                <span className="w-28 sm:text-right">
                  <Link
                    to={`/pedidos/nuevo?repeatId=${o.id}`}
                    className="text-xs border rounded-md px-2 py-1 hover:bg-gray-50"
                  >
                    Repetir pedido
                  </Link>
                </span>
              </div>
            ))}
            {orders.length === 0 && <p className="p-3 text-sm text-gray-500">Sin pedidos todavía.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
