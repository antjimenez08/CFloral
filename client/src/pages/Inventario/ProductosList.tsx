import { FormEvent, useEffect, useState } from "react";
import { api, Product } from "../../api/client";
import { useAuth } from "../../context/AuthContext";

export default function ProductosList() {
  const { currentStoreId } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [stock, setStock] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!currentStoreId) return;
    const res = await api.get<Product[]>("/products", { params: { storeId: currentStoreId } });
    setProducts(res.data);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStoreId]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post("/products", {
        storeId: currentStoreId,
        name,
        unitPrice: Number(unitPrice),
        stock: Number(stock) || 0,
      });
      setName("");
      setUnitPrice("");
      setStock("");
      setShowForm(false);
      load();
    } catch {
      setError("No se pudo crear el producto");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Inventario</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="bg-pink-600 text-white text-sm rounded-md px-3 py-2"
        >
          {showForm ? "Cancelar" : "Nuevo producto"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white p-4 rounded-lg border space-y-3 max-w-md">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div>
            <label className="block text-sm font-medium mb-1">Nombre</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border rounded-md px-3 py-2"
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1">Precio</label>
              <input
                required
                type="number"
                min="0"
                step="0.01"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                className="w-full border rounded-md px-3 py-2"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1">Stock inicial</label>
              <input
                type="number"
                min="0"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                className="w-full border rounded-md px-3 py-2"
              />
            </div>
          </div>
          <button type="submit" className="bg-pink-600 text-white rounded-md px-4 py-2 text-sm">
            Guardar
          </button>
        </form>
      )}

      <div className="bg-white rounded-lg border divide-y">
        <div className="p-3 flex text-xs font-semibold text-gray-500 uppercase">
          <span className="flex-1">Producto</span>
          <span className="w-24 text-right">Precio</span>
          <span className="w-24 text-right">Stock</span>
        </div>
        {products.map((p) => (
          <div key={p.id} className="p-3 flex text-sm items-center">
            <span className="flex-1">{p.name}</span>
            <span className="w-24 text-right">${Number(p.unitPrice).toFixed(2)}</span>
            <span
              className={`w-24 text-right ${p.stock <= p.lowStockThreshold ? "text-red-600 font-semibold" : ""}`}
            >
              {p.stock}
            </span>
          </div>
        ))}
        {products.length === 0 && <p className="p-4 text-sm text-gray-500">Sin productos en esta tienda.</p>}
      </div>
    </div>
  );
}
