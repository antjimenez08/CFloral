import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api, Customer, Order, Persona, Product } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { money } from "../../lib/labels";

interface LineItem {
  productId: string;
  quantity: number;
}

interface ListsResponse {
  paymentMethods?: string[];
  relationships?: string[];
  occasions?: string[];
}

interface CardMessageTemplate {
  id: string;
  occasion: string;
  message: string;
}

export default function PedidoForm() {
  const { currentStoreId } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const editingId = id ?? null;

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [lists, setLists] = useState<ListsResponse>({});

  const [customerId, setCustomerId] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const [customerDetail, setCustomerDetail] = useState<Customer | null>(null);
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");

  const [recipientPersonaId, setRecipientPersonaId] = useState("");
  const [showNewPersona, setShowNewPersona] = useState(false);
  const [newPersonaName, setNewPersonaName] = useState("");
  const [newPersonaRelationship, setNewPersonaRelationship] = useState("");
  const [newPersonaPhone, setNewPersonaPhone] = useState("");

  const [addressId, setAddressId] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryCity, setDeliveryCity] = useState("");

  const [items, setItems] = useState<LineItem[]>([{ productId: "", quantity: 1 }]);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [occasion, setOccasion] = useState("");
  const [cardMessage, setCardMessage] = useState("");
  const [showMessageSuggestions, setShowMessageSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<CardMessageTemplate[]>([]);
  const [notes, setNotes] = useState("");
  const [discount, setDiscount] = useState("");
  const [deliveryFee, setDeliveryFee] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get<Customer[]>("/customers").then((res) => setCustomers(res.data));
    api.get<ListsResponse>("/lists").then((res) => setLists(res.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!currentStoreId) return;
    api.get<Product[]>("/products", { params: { storeId: currentStoreId } }).then((res) => setProducts(res.data));
  }, [currentStoreId]);

  // Precargar desde un pedido existente: edición real, o "Repetir" (sin arrastrar el id).
  useEffect(() => {
    const repeatId = searchParams.get("repeatId");
    const sourceId = editingId ?? repeatId;
    if (!sourceId) {
      const presetCustomerId = searchParams.get("customerId");
      if (presetCustomerId) setCustomerId(presetCustomerId);
      const presetProductId = searchParams.get("productId");
      if (presetProductId) setItems([{ productId: presetProductId, quantity: 1 }]);
      return;
    }
    api.get<Order>(`/orders/${sourceId}`).then((res) => {
      const o = res.data;
      setCustomerId(o.customerId);
      setCustomerSearch(o.customer.name);
      setRecipientPersonaId(o.recipientPersonaId ?? "");
      setDeliveryAddress(o.deliveryAddress ?? "");
      setDeliveryCity(o.deliveryCity ?? "");
      setPaymentMethod(o.paymentMethod ?? "");
      setOccasion(o.occasion ?? "");
      setCardMessage(o.cardMessage ?? "");
      setNotes(o.notes ?? "");
      setDiscount(Number(o.discount) ? String(o.discount) : "");
      setDeliveryFee(Number(o.deliveryFee) ? String(o.deliveryFee) : "");
      setItems(o.items.map((it) => ({ productId: it.productId, quantity: it.quantity })));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId]);

  useEffect(() => {
    if (!customerId) {
      setCustomerDetail(null);
      return;
    }
    api.get<Customer>(`/customers/${customerId}`).then((res) => {
      setCustomerDetail(res.data);
      if (!editingId && !recipientPersonaId) {
        const titular = res.data.personas?.find((p) => p.isTitular);
        if (titular) setRecipientPersonaId(titular.id);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  const selectedPersona: Persona | undefined = customerDetail?.personas?.find((p) => p.id === recipientPersonaId);

  const filteredCustomers = useMemo(() => {
    const term = customerSearch.trim().toLowerCase();
    if (!term) return customers.slice(0, 20);
    return customers.filter((c) => c.name.toLowerCase().includes(term) || (c.phone ?? "").includes(term)).slice(0, 20);
  }, [customers, customerSearch]);

  function selectCustomer(c: Customer) {
    setCustomerId(c.id);
    setCustomerSearch(c.name);
    setCustomerDropdownOpen(false);
    setRecipientPersonaId("");
    setAddressId("");
    setDeliveryAddress("");
    setDeliveryCity("");
  }

  async function createCustomer() {
    if (!newCustomerName.trim()) return;
    const res = await api.post<Customer>("/customers", { name: newCustomerName, phone: newCustomerPhone || undefined });
    setCustomers((prev) => [...prev, res.data]);
    selectCustomer(res.data);
    setShowNewCustomer(false);
    setNewCustomerName("");
    setNewCustomerPhone("");
  }

  async function createPersona() {
    if (!customerId || !newPersonaName.trim() || !newPersonaRelationship) return;
    const res = await api.post<Persona>(`/customers/${customerId}/personas`, {
      name: newPersonaName,
      relationship: newPersonaRelationship,
      phone: newPersonaPhone || undefined,
    });
    setCustomerDetail((prev) => (prev ? { ...prev, personas: [...(prev.personas ?? []), res.data] } : prev));
    setRecipientPersonaId(res.data.id);
    setShowNewPersona(false);
    setNewPersonaName("");
    setNewPersonaRelationship("");
    setNewPersonaPhone("");
  }

  function applyAddress(id: string) {
    setAddressId(id);
    const addr = selectedPersona?.addresses?.find((a) => a.id === id);
    if (!addr) return;
    setDeliveryAddress(addr.address);
    setDeliveryCity(addr.city ?? "");
  }

  function updateItem(index: number, patch: Partial<LineItem>) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }
  function addItem() {
    setItems((prev) => [...prev, { productId: "", quantity: 1 }]);
  }
  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  const subtotal = items.reduce((sum, it) => {
    const product = products.find((p) => p.id === it.productId);
    return sum + (product ? Number(product.unitPrice) * it.quantity : 0);
  }, 0);
  const total = Math.max(0, subtotal - (Number(discount) || 0) + (Number(deliveryFee) || 0));

  async function loadSuggestions() {
    if (!occasion) return;
    const res = await api.get<CardMessageTemplate[]>("/lists/card-messages", { params: { occasion } });
    setSuggestions(res.data);
    setShowMessageSuggestions(true);
  }

  async function saveSuggestedMessage() {
    if (!occasion || !cardMessage.trim()) return;
    await api.post("/lists/card-messages", { occasion, message: cardMessage.trim() });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const body = {
        storeId: currentStoreId,
        customerId,
        recipientPersonaId: recipientPersonaId || undefined,
        recipientName: selectedPersona?.name,
        recipientPhone: selectedPersona?.phone ?? undefined,
        deliveryAddress: deliveryAddress || undefined,
        deliveryCity: deliveryCity || undefined,
        paymentMethod: paymentMethod || undefined,
        occasion: occasion || undefined,
        cardMessage: cardMessage || undefined,
        notes: notes || undefined,
        discount: discount ? Number(discount) : undefined,
        deliveryFee: deliveryFee ? Number(deliveryFee) : undefined,
        items: items.filter((it) => it.productId).map((it) => ({ productId: it.productId, quantity: it.quantity })),
      };
      const res = editingId ? await api.put(`/orders/${editingId}`, body) : await api.post("/orders", body);
      navigate(`/pedidos/${res.data.id}`);
    } catch (err: any) {
      setError(err?.response?.data?.error || "No se pudo guardar el pedido");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-2xl">
      <h1 className="text-xl font-semibold">{editingId ? "Editar pedido" : "Nuevo pedido"}</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <fieldset className="border rounded-lg p-3 space-y-3">
        <legend className="text-sm font-medium px-1">Cliente</legend>
        <div className="relative">
          <input
            placeholder="Buscar cliente por nombre o teléfono..."
            value={customerSearch}
            onChange={(e) => {
              setCustomerSearch(e.target.value);
              setCustomerDropdownOpen(true);
              if (customerId) setCustomerId("");
            }}
            onFocus={() => setCustomerDropdownOpen(true)}
            className="w-full border rounded-md px-3 py-2"
          />
          {customerDropdownOpen && (
            <div className="absolute z-10 bg-white border rounded-md mt-1 w-full max-h-56 overflow-auto shadow-lg">
              {filteredCustomers.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => selectCustomer(c)}
                  className="block w-full text-left px-3 py-2 text-sm hover:bg-pink-50"
                >
                  {c.name} {c.phone && <span className="text-gray-400">· {c.phone}</span>}
                </button>
              ))}
              {filteredCustomers.length === 0 && <p className="px-3 py-2 text-sm text-gray-400">Sin resultados.</p>}
            </div>
          )}
        </div>
        <button type="button" onClick={() => setShowNewCustomer((v) => !v)} className="text-sm text-pink-700">
          {showNewCustomer ? "Cancelar" : "+ Nuevo cliente"}
        </button>
        {showNewCustomer && (
          <div className="grid grid-cols-2 gap-2 bg-gray-50 p-2 rounded-md">
            <input placeholder="Nombre y apellido" value={newCustomerName} onChange={(e) => setNewCustomerName(e.target.value)} className="border rounded-md px-3 py-2" />
            <input placeholder="Teléfono" value={newCustomerPhone} onChange={(e) => setNewCustomerPhone(e.target.value)} className="border rounded-md px-3 py-2" />
            <button type="button" onClick={createCustomer} className="col-span-2 bg-pink-600 text-white rounded-md py-1.5 text-sm">
              Crear cliente
            </button>
          </div>
        )}
      </fieldset>

      {customerId && (
        <fieldset className="border rounded-lg p-3 space-y-3">
          <legend className="text-sm font-medium px-1">Enviar a</legend>
          <select value={recipientPersonaId} onChange={(e) => { setRecipientPersonaId(e.target.value); setAddressId(""); }} className="w-full border rounded-md px-3 py-2">
            <option value="">Selecciona destinatario...</option>
            {customerDetail?.personas?.map((p) => (
              <option key={p.id} value={p.id}>{p.name}{p.isTitular ? " (titular)" : ` — ${p.relationship}`}</option>
            ))}
          </select>
          <button type="button" onClick={() => setShowNewPersona((v) => !v)} className="text-sm text-pink-700">
            {showNewPersona ? "Cancelar" : "+ Nueva persona"}
          </button>
          {showNewPersona && (
            <div className="grid grid-cols-3 gap-2 bg-gray-50 p-2 rounded-md">
              <input placeholder="Nombre" value={newPersonaName} onChange={(e) => setNewPersonaName(e.target.value)} className="border rounded-md px-3 py-2" />
              <select value={newPersonaRelationship} onChange={(e) => setNewPersonaRelationship(e.target.value)} className="border rounded-md px-3 py-2">
                <option value="">Relación...</option>
                {(lists.relationships ?? []).filter((r) => r !== "Titular").map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <input placeholder="Teléfono" value={newPersonaPhone} onChange={(e) => setNewPersonaPhone(e.target.value)} className="border rounded-md px-3 py-2" />
              <button type="button" onClick={createPersona} className="col-span-3 bg-pink-600 text-white rounded-md py-1.5 text-sm">
                Agregar persona
              </button>
            </div>
          )}

          {selectedPersona?.addresses && selectedPersona.addresses.length > 0 && (
            <select value={addressId} onChange={(e) => applyAddress(e.target.value)} className="w-full border rounded-md px-3 py-2">
              <option value="">— Escribir dirección manualmente —</option>
              {selectedPersona.addresses.map((a) => (
                <option key={a.id} value={a.id}>{a.label}: {a.address}</option>
              ))}
            </select>
          )}
          <div className="grid grid-cols-3 gap-2">
            <input placeholder="Dirección de entrega" value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} className="border rounded-md px-3 py-2 col-span-2" />
            <input placeholder="Ciudad" value={deliveryCity} onChange={(e) => setDeliveryCity(e.target.value)} className="border rounded-md px-3 py-2" />
          </div>
        </fieldset>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">Forma de pago</label>
          <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="w-full border rounded-md px-3 py-2">
            <option value="">Selecciona...</option>
            {(lists.paymentMethods ?? []).map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Ocasión</label>
          <select value={occasion} onChange={(e) => { setOccasion(e.target.value); setShowMessageSuggestions(false); }} className="w-full border rounded-md px-3 py-2">
            <option value="">Sin ocasión especial</option>
            {(lists.occasions ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Mensaje de la tarjeta</label>
        <textarea value={cardMessage} onChange={(e) => setCardMessage(e.target.value)} rows={2} className="w-full border rounded-md px-3 py-2" />
        <div className="flex gap-3 mt-1">
          <button type="button" onClick={loadSuggestions} disabled={!occasion} className="text-xs text-pink-700 disabled:text-gray-400">
            Ver mensajes recomendados
          </button>
          <button type="button" onClick={saveSuggestedMessage} disabled={!occasion || !cardMessage.trim()} className="text-xs text-pink-700 disabled:text-gray-400">
            Guardar como mensaje recomendado
          </button>
        </div>
        {showMessageSuggestions && (
          <div className="mt-2 bg-gray-50 rounded-md p-2 space-y-1">
            {suggestions.map((s) => (
              <button type="button" key={s.id} onClick={() => setCardMessage(s.message)} className="block text-left text-sm hover:text-pink-700">
                "{s.message}"
              </button>
            ))}
            {suggestions.length === 0 && <p className="text-xs text-gray-400">Sin mensajes guardados para esta ocasión todavía.</p>}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium">Productos</label>
        {items.map((item, i) => {
          const product = products.find((p) => p.id === item.productId);
          return (
            <div key={i} className="flex gap-2 items-center">
              <select value={item.productId} onChange={(e) => updateItem(i, { productId: e.target.value })} className="flex-1 border rounded-md px-3 py-2">
                <option value="">Selecciona un producto</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({money(p.unitPrice)}) — stock: {p.stock}</option>
                ))}
              </select>
              <input type="number" min="1" max={product?.stock} value={item.quantity} onChange={(e) => updateItem(i, { quantity: Number(e.target.value) })} className="w-20 border rounded-md px-3 py-2" />
              <button type="button" onClick={() => removeItem(i)} className="text-red-600 text-sm">Quitar</button>
            </div>
          );
        })}
        <button type="button" onClick={addItem} className="text-pink-700 text-sm">+ Agregar producto</button>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Anotaciones internas</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full border rounded-md px-3 py-2" rows={2} placeholder="Solo visibles para el equipo, nunca se imprimen para el cliente" />
      </div>

      <div className="grid grid-cols-2 gap-3 max-w-sm ml-auto">
        <div>
          <label className="block text-sm font-medium mb-1">Descuento</label>
          <input type="number" min="0" step="1" value={discount} onChange={(e) => setDiscount(e.target.value)} className="w-full border rounded-md px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Costo de envío</label>
          <input type="number" min="0" step="1" value={deliveryFee} onChange={(e) => setDeliveryFee(e.target.value)} className="w-full border rounded-md px-3 py-2" />
        </div>
      </div>

      <div className="text-right space-y-1">
        <p className="text-sm text-gray-500">Subtotal: {money(subtotal)}</p>
        <p className="text-lg font-semibold">Total: {money(total)}</p>
      </div>

      <div className="flex gap-2">
        <button type="submit" disabled={submitting || !customerId} className="bg-pink-600 text-white rounded-md px-4 py-2 text-sm disabled:opacity-50">
          {submitting ? "Guardando..." : editingId ? "Guardar cambios" : "Crear pedido"}
        </button>
        <button type="button" onClick={() => navigate(-1)} className="border rounded-md px-4 py-2 text-sm">Cancelar</button>
      </div>
    </form>
  );
}
