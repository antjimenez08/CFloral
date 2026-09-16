import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ContactChannel, Customer, Occasion, Product } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { channelLabel, occasionLabel } from "../../lib/labels";

interface LineItem {
  productId: string;
  quantity: number;
}

export default function PedidoForm() {
  const { currentStoreId } = useAuth();
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [customerDetail, setCustomerDetail] = useState<Customer | null>(null);
  const [items, setItems] = useState<LineItem[]>([{ productId: "", quantity: 1 }]);
  const [notes, setNotes] = useState("");

  const [occasion, setOccasion] = useState<Occasion>("NO_OCCASION");
  const [channel, setChannel] = useState<ContactChannel>("WALK_IN");
  const [isRush, setIsRush] = useState(false);
  const [cardMessage, setCardMessage] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [recipientRelationship, setRecipientRelationship] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState<"PICKUP" | "DELIVERY">("PICKUP");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryCity, setDeliveryCity] = useState("");
  const [deliveryWindow, setDeliveryWindow] = useState("");
  const [savedAddressId, setSavedAddressId] = useState("");
  const [discount, setDiscount] = useState("");
  const [deliveryFee, setDeliveryFee] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get<Customer[]>("/customers").then((res) => setCustomers(res.data));
  }, []);

  useEffect(() => {
    if (!currentStoreId) return;
    api.get<Product[]>("/products", { params: { storeId: currentStoreId } }).then((res) => setProducts(res.data));
  }, [currentStoreId]);

  useEffect(() => {
    if (!customerId) {
      setCustomerDetail(null);
      return;
    }
    api.get<Customer>(`/customers/${customerId}`).then((res) => setCustomerDetail(res.data));
  }, [customerId]);

  function applySavedAddress(addressId: string) {
    setSavedAddressId(addressId);
    const addr = customerDetail?.addresses?.find((a) => a.id === addressId);
    if (!addr) return;
    setDeliveryMethod("DELIVERY");
    setDeliveryAddress(addr.address);
    setDeliveryCity(addr.city ?? "");
    if (addr.recipientName) setRecipientName(addr.recipientName);
    if (addr.phone) setRecipientPhone(addr.phone);
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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await api.post("/orders", {
        storeId: currentStoreId,
        customerId,
        notes,
        occasion,
        channel,
        isRush,
        cardMessage: cardMessage || undefined,
        recipientName: recipientName || undefined,
        recipientPhone: recipientPhone || undefined,
        recipientRelationship: recipientRelationship || undefined,
        deliveryMethod,
        deliveryAddress: deliveryMethod === "DELIVERY" ? deliveryAddress || undefined : undefined,
        deliveryCity: deliveryMethod === "DELIVERY" ? deliveryCity || undefined : undefined,
        deliveryWindow: deliveryMethod === "DELIVERY" ? deliveryWindow || undefined : undefined,
        discount: discount ? Number(discount) : undefined,
        deliveryFee: deliveryFee ? Number(deliveryFee) : undefined,
        items: items.filter((it) => it.productId).map((it) => ({ productId: it.productId, quantity: it.quantity })),
      });
      navigate(`/pedidos/${res.data.id}`);
    } catch (err: any) {
      setError(err?.response?.data?.error || "No se pudo crear el pedido");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-2xl">
      <h1 className="text-xl font-semibold">Nuevo pedido</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-sm font-medium mb-1">Cliente</label>
          <select required value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="w-full border rounded-md px-3 py-2">
            <option value="">Selecciona un cliente</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Ocasión</label>
          <select value={occasion} onChange={(e) => setOccasion(e.target.value as Occasion)} className="w-full border rounded-md px-3 py-2">
            {Object.entries(occasionLabel).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Canal del pedido</label>
          <select value={channel} onChange={(e) => setChannel(e.target.value as ContactChannel)} className="w-full border rounded-md px-3 py-2">
            {Object.entries(channelLabel).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
      </div>

      <fieldset className="border rounded-lg p-3 space-y-3">
        <legend className="text-sm font-medium px-1">Destinatario (si es un regalo)</legend>
        {customerDetail?.addresses && customerDetail.addresses.length > 0 && (
          <div>
            <label className="block text-sm font-medium mb-1">Usar dirección guardada</label>
            <select value={savedAddressId} onChange={(e) => applySavedAddress(e.target.value)} className="w-full border rounded-md px-3 py-2">
              <option value="">— Escribir manualmente —</option>
              {customerDetail.addresses.map((a) => (
                <option key={a.id} value={a.id}>{a.label}{a.recipientName ? ` (${a.recipientName})` : ""}</option>
              ))}
            </select>
          </div>
        )}
        <div className="grid grid-cols-3 gap-2">
          <input placeholder="Nombre de quien recibe" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} className="border rounded-md px-3 py-2" />
          <input placeholder="Teléfono" value={recipientPhone} onChange={(e) => setRecipientPhone(e.target.value)} className="border rounded-md px-3 py-2" />
          <input placeholder="Relación (esposa, mamá...)" value={recipientRelationship} onChange={(e) => setRecipientRelationship(e.target.value)} className="border rounded-md px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Mensaje de la tarjeta</label>
          <textarea value={cardMessage} onChange={(e) => setCardMessage(e.target.value)} rows={2} className="w-full border rounded-md px-3 py-2" />
        </div>
      </fieldset>

      <fieldset className="border rounded-lg p-3 space-y-3">
        <legend className="text-sm font-medium px-1">Entrega</legend>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-1.5">
            <input type="radio" checked={deliveryMethod === "PICKUP"} onChange={() => setDeliveryMethod("PICKUP")} /> Recoger en tienda
          </label>
          <label className="flex items-center gap-1.5">
            <input type="radio" checked={deliveryMethod === "DELIVERY"} onChange={() => setDeliveryMethod("DELIVERY")} /> Domicilio
          </label>
          <label className="flex items-center gap-1.5 ml-auto">
            <input type="checkbox" checked={isRush} onChange={(e) => setIsRush(e.target.checked)} /> Urgente
          </label>
        </div>
        {deliveryMethod === "DELIVERY" && (
          <div className="grid grid-cols-3 gap-2">
            <input placeholder="Dirección de entrega" value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} className="border rounded-md px-3 py-2 col-span-2" />
            <input placeholder="Ciudad" value={deliveryCity} onChange={(e) => setDeliveryCity(e.target.value)} className="border rounded-md px-3 py-2" />
            <input placeholder="Ventana horaria (ej. 2pm - 4pm)" value={deliveryWindow} onChange={(e) => setDeliveryWindow(e.target.value)} className="border rounded-md px-3 py-2 col-span-3" />
          </div>
        )}
      </fieldset>

      <div className="space-y-2">
        <label className="block text-sm font-medium">Productos</label>
        {items.map((item, i) => (
          <div key={i} className="flex gap-2 items-center">
            <select
              value={item.productId}
              onChange={(e) => updateItem(i, { productId: e.target.value })}
              className="flex-1 border rounded-md px-3 py-2"
            >
              <option value="">Selecciona un producto</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (${Number(p.unitPrice).toFixed(2)}) — stock: {p.stock}
                </option>
              ))}
            </select>
            <input
              type="number"
              min="1"
              value={item.quantity}
              onChange={(e) => updateItem(i, { quantity: Number(e.target.value) })}
              className="w-20 border rounded-md px-3 py-2"
            />
            <button type="button" onClick={() => removeItem(i)} className="text-red-600 text-sm">
              Quitar
            </button>
          </div>
        ))}
        <button type="button" onClick={addItem} className="text-pink-700 text-sm">
          + Agregar producto
        </button>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Notas internas</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full border rounded-md px-3 py-2" rows={2} />
      </div>

      <div className="grid grid-cols-2 gap-3 max-w-sm ml-auto">
        <div>
          <label className="block text-sm font-medium mb-1">Descuento</label>
          <input type="number" min="0" step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} className="w-full border rounded-md px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Costo de envío</label>
          <input type="number" min="0" step="0.01" value={deliveryFee} onChange={(e) => setDeliveryFee(e.target.value)} className="w-full border rounded-md px-3 py-2" />
        </div>
      </div>

      <div className="text-right space-y-1">
        <p className="text-sm text-gray-500">Subtotal: ${subtotal.toFixed(2)}</p>
        <p className="text-lg font-semibold">Total: ${total.toFixed(2)}</p>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="bg-pink-600 text-white rounded-md px-4 py-2 text-sm disabled:opacity-50"
      >
        {submitting ? "Creando..." : "Crear pedido y generar factura"}
      </button>
    </form>
  );
}
