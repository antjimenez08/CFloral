import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, Customer, Product } from "../../api/client";
import { useAuth } from "../../context/AuthContext";

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
  const [items, setItems] = useState<LineItem[]>([{ productId: "", quantity: 1 }]);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get<Customer[]>("/customers").then((res) => setCustomers(res.data));
  }, []);

  useEffect(() => {
    if (!currentStoreId) return;
    api.get<Product[]>("/products", { params: { storeId: currentStoreId } }).then((res) => setProducts(res.data));
  }, [currentStoreId]);

  function updateItem(index: number, patch: Partial<LineItem>) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  function addItem() {
    setItems((prev) => [...prev, { productId: "", quantity: 1 }]);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  const total = items.reduce((sum, it) => {
    const product = products.find((p) => p.id === it.productId);
    return sum + (product ? Number(product.unitPrice) * it.quantity : 0);
  }, 0);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await api.post("/orders", {
        storeId: currentStoreId,
        customerId,
        notes,
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
    <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
      <h1 className="text-xl font-semibold">Nuevo pedido</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div>
        <label className="block text-sm font-medium mb-1">Cliente</label>
        <select
          required
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
          className="w-full border rounded-md px-3 py-2"
        >
          <option value="">Selecciona un cliente</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

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
        <label className="block text-sm font-medium mb-1">Notas</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full border rounded-md px-3 py-2"
          rows={2}
        />
      </div>

      <div className="text-lg font-semibold">Total: ${total.toFixed(2)}</div>

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
