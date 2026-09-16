import { FormEvent, useEffect, useState } from "react";
import { api, Product, ProductCategory } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { categoryLabel } from "../../lib/labels";

export default function ProductosList() {
  const { currentStoreId } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<ProductCategory>("FLOWERS");
  const [sku, setSku] = useState("");
  const [color, setColor] = useState("");
  const [tags, setTags] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [stock, setStock] = useState("");
  const [lowStockThreshold, setLowStockThreshold] = useState("5");
  const [reorderQuantity, setReorderQuantity] = useState("");
  const [shelfLifeDays, setShelfLifeDays] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!currentStoreId) return;
    const res = await api.get<Product[]>("/products", {
      params: { storeId: currentStoreId, category: categoryFilter || undefined },
    });
    setProducts(res.data);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStoreId, categoryFilter]);

  function resetForm() {
    setName("");
    setCategory("FLOWERS");
    setSku("");
    setColor("");
    setTags("");
    setUnitPrice("");
    setCostPrice("");
    setStock("");
    setLowStockThreshold("5");
    setReorderQuantity("");
    setShelfLifeDays("");
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post("/products", {
        storeId: currentStoreId,
        name,
        category,
        sku: sku || undefined,
        color: color || undefined,
        tags: tags || undefined,
        unitPrice: Number(unitPrice),
        costPrice: costPrice ? Number(costPrice) : undefined,
        stock: Number(stock) || 0,
        lowStockThreshold: Number(lowStockThreshold) || 5,
        reorderQuantity: reorderQuantity ? Number(reorderQuantity) : undefined,
        shelfLifeDays: shelfLifeDays ? Number(shelfLifeDays) : undefined,
      });
      resetForm();
      setShowForm(false);
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error || "No se pudo crear el producto");
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
        <form onSubmit={handleCreate} className="bg-white p-4 rounded-lg border space-y-3 max-w-2xl">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1">Nombre</label>
              <input required value={name} onChange={(e) => setName(e.target.value)} className="w-full border rounded-md px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Categoría</label>
              <select value={category} onChange={(e) => setCategory(e.target.value as ProductCategory)} className="w-full border rounded-md px-3 py-2">
                {Object.entries(categoryLabel).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">SKU / código interno</label>
              <input value={sku} onChange={(e) => setSku(e.target.value)} className="w-full border rounded-md px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Color</label>
              <input value={color} onChange={(e) => setColor(e.target.value)} className="w-full border rounded-md px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Etiquetas de ocasión</label>
              <input placeholder="cumpleaños, amor..." value={tags} onChange={(e) => setTags(e.target.value)} className="w-full border rounded-md px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Precio de venta</label>
              <input required type="number" min="0" step="0.01" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} className="w-full border rounded-md px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Costo (para margen)</label>
              <input type="number" min="0" step="0.01" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} className="w-full border rounded-md px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Stock inicial</label>
              <input type="number" min="0" value={stock} onChange={(e) => setStock(e.target.value)} className="w-full border rounded-md px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Alerta de stock bajo</label>
              <input type="number" min="0" value={lowStockThreshold} onChange={(e) => setLowStockThreshold(e.target.value)} className="w-full border rounded-md px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Cantidad sugerida de reorden</label>
              <input type="number" min="0" value={reorderQuantity} onChange={(e) => setReorderQuantity(e.target.value)} className="w-full border rounded-md px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Vida útil (días, si es perecedero)</label>
              <input type="number" min="1" value={shelfLifeDays} onChange={(e) => setShelfLifeDays(e.target.value)} className="w-full border rounded-md px-3 py-2" />
            </div>
          </div>
          <button type="submit" className="bg-pink-600 text-white rounded-md px-4 py-2 text-sm">
            Guardar
          </button>
        </form>
      )}

      <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="border rounded-md px-3 py-2 text-sm">
        <option value="">Todas las categorías</option>
        {Object.entries(categoryLabel).map(([k, v]) => (
          <option key={k} value={k}>{v}</option>
        ))}
      </select>

      <div className="bg-white rounded-lg border divide-y">
        <div className="p-3 hidden sm:flex text-xs font-semibold text-gray-500 uppercase">
          <span className="flex-1">Producto</span>
          <span className="w-28">Categoría</span>
          <span className="w-20 text-right">Precio</span>
          <span className="w-20 text-right">Margen</span>
          <span className="w-16 text-right">Stock</span>
        </div>
        {products.map((p) => {
          const margin = p.costPrice ? Number(p.unitPrice) - Number(p.costPrice) : null;
          const low = p.stock <= p.lowStockThreshold;
          return (
            <div key={p.id} className="p-3 flex flex-col sm:flex-row sm:items-center text-sm gap-1 sm:gap-0">
              <span className="flex-1">
                {p.name}
                {p.sku && <span className="text-xs text-gray-400 ml-2">{p.sku}</span>}
              </span>
              <span className="w-28 text-gray-500">{categoryLabel[p.category]}</span>
              <span className="w-20 sm:text-right">${Number(p.unitPrice).toFixed(2)}</span>
              <span className="w-20 sm:text-right text-gray-500">{margin !== null ? `$${margin.toFixed(2)}` : "—"}</span>
              <span className={`w-16 sm:text-right ${low ? "text-red-600 font-semibold" : ""}`}>
                {p.stock}
                {low && <span className="block sm:inline text-xs"> (reordenar{p.reorderQuantity ? ` ${p.reorderQuantity}` : ""})</span>}
              </span>
            </div>
          );
        })}
        {products.length === 0 && <p className="p-4 text-sm text-gray-500">Sin productos en esta tienda.</p>}
      </div>
    </div>
  );
}
