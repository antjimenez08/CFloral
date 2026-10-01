import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, Product } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { money } from "../../lib/labels";

export default function CatalogoPage() {
  const { currentStoreId } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [category, setCategory] = useState("Todas");

  useEffect(() => {
    if (!currentStoreId) return;
    api.get<Product[]>("/products", { params: { storeId: currentStoreId } }).then((res) => setProducts(res.data));
  }, [currentStoreId]);

  const categories = useMemo(() => {
    const set = new Set(products.map((p) => p.category).filter(Boolean));
    return ["Todas", ...Array.from(set).sort((a, b) => a.localeCompare(b, "es"))];
  }, [products]);

  const visible = category === "Todas" ? products : products.filter((p) => p.category === category);

  function pedir(product: Product) {
    navigate(`/pedidos/nuevo?productId=${product.id}`);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Catálogo</h1>

      <div className="flex gap-2 flex-wrap">
        {categories.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            className={`text-sm rounded-full px-3 py-1.5 border ${
              category === c ? "bg-[var(--accent,#db2777)] text-white border-transparent" : "hover:bg-pink-50"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {visible.map((p) => {
          const outOfStock = p.stock <= 0;
          return (
            <div key={p.id} className="bg-white border rounded-lg overflow-hidden flex flex-col">
              <div className="aspect-square bg-pink-50 flex items-center justify-center overflow-hidden">
                {p.coverPhoto ? (
                  <img src={p.coverPhoto} alt={p.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-4xl">🌸</span>
                )}
              </div>
              <div className="p-3 flex flex-col gap-1 flex-1">
                <p className="text-sm font-medium leading-tight">{p.name}</p>
                {outOfStock && <span className="text-xs font-semibold text-red-600">Agotado</span>}
                <div className="mt-auto flex items-center justify-between pt-2">
                  <span className="font-semibold">{money(p.unitPrice)}</span>
                  <button
                    type="button"
                    disabled={outOfStock}
                    onClick={() => pedir(p)}
                    className="bg-pink-600 text-white text-xs rounded-md px-3 py-1.5 disabled:opacity-40"
                  >
                    Pedir
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        {visible.length === 0 && <p className="text-sm text-gray-500 col-span-full">No hay productos en esta categoría.</p>}
      </div>
    </div>
  );
}
