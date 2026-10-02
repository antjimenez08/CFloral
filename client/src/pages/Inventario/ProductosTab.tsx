import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { api, Product, Supply } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { resizeImageFile } from "../../lib/imageResize";

const money = (n: number) =>
  n.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

interface ListsResponse {
  productCategories?: string[];
  [key: string]: string[] | undefined;
}

interface RecipeRow {
  supplyId: string;
  quantity: string;
}

const NEW_CATEGORY = "__new__";

const emptyForm = {
  name: "",
  category: "",
  unit: "unidad",
  unitPrice: "",
  stock: "",
  lowStockThreshold: "5",
  reorderQuantity: "",
  shelfLifeDays: "",
  laborCost: "",
};

export default function ProductosTab() {
  const { currentStoreId, stores, can } = useAuth();
  const canCosto = can("inventarioCosto");

  const [products, setProducts] = useState<Product[]>([]);
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [categoryFilter, setCategoryFilter] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [coverPhoto, setCoverPhoto] = useState<string | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [recipe, setRecipe] = useState<RecipeRow[]>([]);
  const [recipeSupplyId, setRecipeSupplyId] = useState("");
  const [recipeQty, setRecipeQty] = useState("");
  const [laborTouched, setLaborTouched] = useState(false);
  const [existingLinkedStoreIds, setExistingLinkedStoreIds] = useState<string[]>([]);
  const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>([]);
  const [newCategory, setNewCategory] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function loadProducts() {
    if (!currentStoreId) return;
    const res = await api.get<Product[]>("/products", { params: { storeId: currentStoreId } });
    setProducts(res.data);
  }

  async function loadSupplies() {
    if (!currentStoreId) return;
    const res = await api.get<Supply[]>("/supplies", { params: { storeId: currentStoreId } });
    setSupplies(res.data);
  }

  async function loadLists() {
    try {
      const res = await api.get<ListsResponse>("/lists");
      setCategories(res.data.productCategories || []);
    } catch {
      setCategories([]);
    }
  }

  useEffect(() => {
    loadProducts();
    loadSupplies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStoreId]);

  useEffect(() => {
    loadLists();
  }, []);

  const supplyById = useMemo(() => {
    const map = new Map<string, Supply>();
    supplies.forEach((s) => map.set(s.id, s));
    return map;
  }, [supplies]);

  const recipeTotal = useMemo(
    () =>
      recipe.reduce((sum, r) => {
        const supply = supplyById.get(r.supplyId);
        const qty = Number(r.quantity) || 0;
        return sum + (supply ? Number(supply.costPerUnit) * qty : 0);
      }, 0),
    [recipe, supplyById]
  );

  // Live labor-cost suggestion (mockup-spec §1.2), recomputed unless the user has typed their own value.
  useEffect(() => {
    if (laborTouched) return;
    const unitPrice = Number(form.unitPrice) || 0;
    const fromInsumos = recipeTotal * 0.35;
    const fromMercado = Math.max(0, unitPrice * 0.5 - recipeTotal);
    const suggested = Math.round((fromInsumos + fromMercado) / 2 / 500) * 500;
    setForm((f) => (f.laborCost === String(suggested) ? f : { ...f, laborCost: String(suggested) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipeTotal, form.unitPrice, laborTouched]);

  const costTotal = recipeTotal + (Number(form.laborCost) || 0);

  function resetForm() {
    setForm(emptyForm);
    setCoverPhoto(null);
    setPhotos([]);
    setRecipe([]);
    setRecipeSupplyId("");
    setRecipeQty("");
    setLaborTouched(false);
    setExistingLinkedStoreIds([]);
    setSelectedStoreIds([]);
    setNewCategory("");
    setEditingId(null);
    setError(null);
  }

  function toggleForm() {
    if (showForm) {
      resetForm();
      setShowForm(false);
    } else {
      resetForm();
      setShowForm(true);
    }
  }

  async function openEditForm(id: string) {
    setError(null);
    try {
      const res = await api.get<Product>(`/products/${id}`);
      const p = res.data;
      setEditingId(p.id);
      setForm({
        name: p.name,
        category: p.category || "",
        unit: p.unit || "unidad",
        unitPrice: String(p.unitPrice ?? ""),
        stock: String(p.stock ?? ""),
        lowStockThreshold: String(p.lowStockThreshold ?? "5"),
        reorderQuantity: p.reorderQuantity != null ? String(p.reorderQuantity) : "",
        shelfLifeDays: p.shelfLifeDays != null ? String(p.shelfLifeDays) : "",
        laborCost: String(p.laborCost ?? "0"),
      });
      setCoverPhoto(p.coverPhoto || null);
      setPhotos(p.photos || []);
      setRecipe((p.recipe || []).map((r) => ({ supplyId: r.supplyId, quantity: String(r.quantity) })));
      setLaborTouched(true); // preserve the saved labor cost instead of silently overwriting it with a fresh suggestion
      setExistingLinkedStoreIds(p.linkedStoreIds || []);
      setSelectedStoreIds([]);
      setNewCategory("");
      setShowForm(true);
    } catch (err: any) {
      setError(err?.response?.data?.error || "No se pudo cargar el producto");
    }
  }

  async function handleCoverPhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverPhoto(await resizeImageFile(file));
  }

  async function handleExtraPhotos(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    for (const file of files) {
      const resized = await resizeImageFile(file);
      setPhotos((prev) => [...prev, resized]);
    }
  }

  function removePhoto(idx: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== idx));
  }

  function addRecipeRow() {
    if (!recipeSupplyId || !recipeQty || Number(recipeQty) <= 0) return;
    setRecipe((prev) => {
      const existing = prev.find((r) => r.supplyId === recipeSupplyId);
      if (existing) {
        return prev.map((r) =>
          r.supplyId === recipeSupplyId ? { ...r, quantity: String((Number(r.quantity) || 0) + Number(recipeQty)) } : r
        );
      }
      return [...prev, { supplyId: recipeSupplyId, quantity: recipeQty }];
    });
    setRecipeSupplyId("");
    setRecipeQty("");
  }

  function removeRecipeRow(supplyId: string) {
    setRecipe((prev) => prev.filter((r) => r.supplyId !== supplyId));
  }

  function toggleStore(storeId: string) {
    setSelectedStoreIds((prev) => (prev.includes(storeId) ? prev.filter((id) => id !== storeId) : [...prev, storeId]));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!currentStoreId) return;
    if (!form.name.trim()) {
      setError("El nombre es obligatorio");
      return;
    }
    const category = form.category === NEW_CATEGORY ? newCategory.trim() : form.category;
    setSaving(true);
    try {
      const payload = {
        storeId: currentStoreId,
        name: form.name.trim(),
        category: category || undefined,
        unit: form.unit || "unidad",
        unitPrice: Number(form.unitPrice) || 0,
        costPrice: costTotal,
        laborCost: Number(form.laborCost) || 0,
        stock: Number(form.stock) || 0,
        lowStockThreshold: Number(form.lowStockThreshold) || 5,
        reorderQuantity: form.reorderQuantity ? Number(form.reorderQuantity) : undefined,
        shelfLifeDays: form.shelfLifeDays ? Number(form.shelfLifeDays) : undefined,
        coverPhoto: coverPhoto || undefined,
        photos,
        recipe: recipe
          .filter((r) => r.supplyId && Number(r.quantity) > 0)
          .map((r) => ({ supplyId: r.supplyId, quantity: Number(r.quantity) })),
      };

      let productId = editingId;
      if (editingId) {
        await api.put(`/products/${editingId}`, payload);
      } else {
        const res = await api.post<Product>("/products", payload);
        productId = res.data.id;
      }

      const newlyLinked = selectedStoreIds.filter((id) => !existingLinkedStoreIds.includes(id));
      if (productId && newlyLinked.length > 0) {
        await api.post(`/products/${productId}/link-to-stores`, { storeIds: newlyLinked });
      }

      resetForm();
      setShowForm(false);
      loadProducts();
    } catch (err: any) {
      setError(err?.response?.data?.error || "No se pudo guardar el producto");
    } finally {
      setSaving(false);
    }
  }

  const filterOptions = useMemo(() => {
    const set = new Set<string>(categories);
    products.forEach((p) => p.category && set.add(p.category));
    return Array.from(set);
  }, [categories, products]);

  const filtered = categoryFilter ? products.filter((p) => p.category === categoryFilter) : products;
  const otherStores = stores.filter((s) => s.id !== currentStoreId && s.active);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Productos</h2>
        <button onClick={toggleForm} className="bg-pink-600 text-white text-sm rounded-md px-3 py-2">
          {showForm ? "Cancelar" : "Nuevo producto"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white p-4 rounded-lg border space-y-4 max-w-3xl">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1">Nombre</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full border rounded-md px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Categoría</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full border rounded-md px-3 py-2"
              >
                <option value="">Sin categoría</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
                <option value={NEW_CATEGORY}>+ Nueva categoría...</option>
              </select>
              {form.category === NEW_CATEGORY && (
                <input
                  autoFocus
                  placeholder="Nombre de la categoría"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full border rounded-md px-3 py-2 mt-2"
                />
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Unidad</label>
              <input
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
                className="w-full border rounded-md px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Precio de venta</label>
              <input
                required
                type="number"
                min="0"
                step="0.01"
                value={form.unitPrice}
                onChange={(e) => setForm({ ...form, unitPrice: e.target.value })}
                className="w-full border rounded-md px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Stock</label>
              <input
                type="number"
                min="0"
                value={form.stock}
                onChange={(e) => setForm({ ...form, stock: e.target.value })}
                className="w-full border rounded-md px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Alerta de stock bajo</label>
              <input
                type="number"
                min="0"
                value={form.lowStockThreshold}
                onChange={(e) => setForm({ ...form, lowStockThreshold: e.target.value })}
                className="w-full border rounded-md px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Cantidad sugerida de reorden</label>
              <input
                type="number"
                min="0"
                value={form.reorderQuantity}
                onChange={(e) => setForm({ ...form, reorderQuantity: e.target.value })}
                className="w-full border rounded-md px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Vida útil (días, si es perecedero)</label>
              <input
                type="number"
                min="1"
                value={form.shelfLifeDays}
                onChange={(e) => setForm({ ...form, shelfLifeDays: e.target.value })}
                className="w-full border rounded-md px-3 py-2"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Foto de carátula</label>
              <input type="file" accept="image/*" onChange={handleCoverPhoto} className="w-full text-sm" />
              {coverPhoto && (
                <div className="mt-2 flex items-center gap-2">
                  <img src={coverPhoto} alt="Carátula" className="w-16 h-16 object-cover rounded-md border" />
                  <button type="button" onClick={() => setCoverPhoto(null)} className="text-xs text-red-600">
                    Quitar
                  </button>
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Fotos adicionales</label>
              <input type="file" accept="image/*" multiple onChange={handleExtraPhotos} className="w-full text-sm" />
              {photos.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {photos.map((photo, idx) => (
                    <div key={idx} className="relative">
                      <img src={photo} alt="" className="w-12 h-12 object-cover rounded-md border" />
                      <button
                        type="button"
                        onClick={() => removePhoto(idx)}
                        className="absolute -top-1 -right-1 bg-white border rounded-full text-xs w-4 h-4 leading-none"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {otherStores.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-1">Disponible también en estas tiendas</label>
              <div className="flex flex-wrap gap-3">
                {otherStores.map((s) => {
                  const alreadyLinked = existingLinkedStoreIds.includes(s.id);
                  return (
                    <label key={s.id} className="flex items-center gap-1 text-sm">
                      <input
                        type="checkbox"
                        checked={alreadyLinked || selectedStoreIds.includes(s.id)}
                        disabled={alreadyLinked}
                        onChange={() => toggleStore(s.id)}
                      />
                      {s.name}
                      {alreadyLinked && <span className="text-xs text-gray-400">(ya vinculado)</span>}
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <div className="border rounded-md p-3 space-y-2">
            <label className="block text-sm font-medium">Receta (insumos)</label>
            <div className="flex gap-2 items-end">
              <select
                value={recipeSupplyId}
                onChange={(e) => setRecipeSupplyId(e.target.value)}
                className="border rounded-md px-2 py-1 text-sm flex-1"
              >
                <option value="">Seleccionar insumo...</option>
                {supplies.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.unit})
                  </option>
                ))}
              </select>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Cantidad"
                value={recipeQty}
                onChange={(e) => setRecipeQty(e.target.value)}
                className="border rounded-md px-2 py-1 text-sm w-28"
              />
              <button type="button" onClick={addRecipeRow} className="border rounded-md px-3 py-1 text-sm hover:bg-gray-50">
                Agregar
              </button>
            </div>
            {recipe.length > 0 && (
              <div className="divide-y text-sm">
                {recipe.map((r) => {
                  const supply = supplyById.get(r.supplyId);
                  return (
                    <div key={r.supplyId} className="flex items-center justify-between py-1">
                      <span>
                        {supply ? supply.name : r.supplyId} × {r.quantity}
                        {supply && <span className="text-gray-400"> ({supply.unit})</span>}
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="text-gray-500">
                          {supply ? money(Number(supply.costPerUnit) * Number(r.quantity)) : "—"}
                        </span>
                        <button type="button" onClick={() => removeRecipeRow(r.supplyId)} className="text-xs text-red-600">
                          Quitar
                        </button>
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
            <p className="text-sm font-medium text-right">Costo de insumos: {money(recipeTotal)}</p>
          </div>

          <div className="grid grid-cols-2 gap-3 items-end">
            <div>
              <label className="block text-sm font-medium mb-1">Mano de obra</label>
              <input
                type="number"
                min="0"
                step="500"
                value={form.laborCost}
                onChange={(e) => {
                  setLaborTouched(true);
                  setForm({ ...form, laborCost: e.target.value });
                }}
                className="w-full border rounded-md px-3 py-2"
              />
              <p className="text-xs text-gray-400 mt-1">Sugerido automáticamente; puedes ajustarlo.</p>
            </div>
            <p className="text-sm">
              Costo total: <span className="font-semibold">{money(costTotal)}</span>
            </p>
          </div>

          <button disabled={saving} type="submit" className="bg-pink-600 text-white rounded-md px-4 py-2 text-sm disabled:opacity-50">
            Guardar
          </button>
        </form>
      )}

      {filterOptions.length > 0 && (
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="border rounded-md px-3 py-2 text-sm">
          <option value="">Todas las categorías</option>
          {filterOptions.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      )}

      <div className="bg-white rounded-lg border divide-y overflow-x-auto">
        <div className="p-3 hidden sm:flex text-xs font-semibold text-gray-500 uppercase min-w-[640px]">
          <span className="w-12"></span>
          <span className="flex-1">Producto</span>
          <span className="w-28">Categoría</span>
          <span className="w-24 text-right">Precio</span>
          {canCosto && <span className="w-24 text-right">Costo</span>}
          {canCosto && <span className="w-20 text-right">Margen</span>}
          <span className="w-16 text-right">Stock</span>
        </div>
        {filtered.map((p) => {
          const low = p.stock <= p.lowStockThreshold;
          const margin =
            p.costPrice && Number(p.unitPrice) > 0
              ? ((Number(p.unitPrice) - Number(p.costPrice)) / Number(p.unitPrice)) * 100
              : null;
          return (
            <div
              key={p.id}
              onClick={() => openEditForm(p.id)}
              className="p-3 flex flex-col sm:flex-row sm:items-center text-sm gap-1 sm:gap-0 cursor-pointer hover:bg-pink-50 min-w-[640px]"
            >
              <span className="w-12">
                {p.coverPhoto ? (
                  <img src={p.coverPhoto} alt="" className="w-10 h-10 object-cover rounded-md border" />
                ) : (
                  <span className="w-10 h-10 flex items-center justify-center rounded-md border bg-gray-50 text-gray-300 text-xs">
                    s/f
                  </span>
                )}
              </span>
              <span className="flex-1">
                {p.name}
                {p.recipe && p.recipe.length > 0 && (
                  <span className="block text-xs text-gray-400">Receta: {p.recipe.length} insumos</span>
                )}
                {p.linkedStoreIds && p.linkedStoreIds.length > 0 && (
                  <span className="block text-xs text-gray-400">Disponible en {p.linkedStoreIds.length + 1} tiendas</span>
                )}
              </span>
              <span className="w-28 text-gray-500">{p.category || "—"}</span>
              <span className="w-24 sm:text-right">{money(Number(p.unitPrice))}</span>
              {canCosto && (
                <span className="w-24 sm:text-right text-gray-500">{p.costPrice ? money(Number(p.costPrice)) : "—"}</span>
              )}
              {canCosto && (
                <span className="w-20 sm:text-right text-gray-500">{margin !== null ? `${margin.toFixed(0)}%` : "—"}</span>
              )}
              <span className={`w-16 sm:text-right ${low ? "text-red-600 font-semibold" : ""}`}>{p.stock}</span>
            </div>
          );
        })}
        {filtered.length === 0 && <p className="p-4 text-sm text-gray-500">Sin productos en esta tienda.</p>}
      </div>
    </div>
  );
}
