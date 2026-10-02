import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { applyStoreTheme } from "../lib/theme";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `block rounded-lg px-3 py-2 text-sm font-medium ${
    isActive ? "bg-[var(--accent,#db2777)] text-[var(--accent-ink,#fff)]" : "text-gray-700 hover:bg-pink-50"
  }`;

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export default function DashboardLayout() {
  const { user, stores, currentStoreId, setCurrentStoreId, logout, can, refreshUser } = useAuth();
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState(user?.name ?? "");
  const [phoneDraft, setPhoneDraft] = useState(user?.phone ?? "");
  const avatarRef = useRef<HTMLDivElement>(null);

  const currentStore = stores.find((s) => s.id === currentStoreId) ?? null;

  useEffect(() => {
    applyStoreTheme(currentStore);
  }, [currentStore]);

  useEffect(() => {
    function onOutsideClick(e: MouseEvent) {
      if (avatarRef.current && !avatarRef.current.contains(e.target as Node)) {
        setPopoverOpen(false);
        setEditing(false);
      }
    }
    document.addEventListener("mousedown", onOutsideClick);
    return () => document.removeEventListener("mousedown", onOutsideClick);
  }, []);

  async function saveProfile() {
    const res = await api.put("/users/me/profile", { name: nameDraft, phone: phoneDraft });
    refreshUser({ name: res.data.name, phone: res.data.phone });
    setEditing(false);
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {currentStore?.logo ? (
            <img src={currentStore.logo} alt={currentStore.name} className="h-9 w-9 object-contain rounded" />
          ) : (
            <span className="text-xl font-bold text-[var(--accent,#db2777)]">compañíafloral</span>
          )}
          {user?.role === "ADMIN" ? (
            <select
              className="border rounded-md px-2 py-1 text-sm"
              value={currentStoreId ?? ""}
              onChange={(e) => setCurrentStoreId(e.target.value)}
            >
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-sm text-gray-500">{user?.storeName}</span>
          )}
        </div>
        <div className="relative" ref={avatarRef}>
          <button
            onClick={() => setPopoverOpen((v) => !v)}
            className="h-9 w-9 rounded-full bg-[var(--accent-soft,#fde8f0)] text-[var(--accent,#db2777)] font-semibold flex items-center justify-center text-sm"
          >
            {user ? initials(user.name) : ""}
          </button>
          {popoverOpen && user && (
            <div className="absolute right-0 mt-2 w-64 bg-white border rounded-lg shadow-lg p-3 text-sm space-y-2 z-20">
              {!editing ? (
                <>
                  <p className="font-medium">{user.name}</p>
                  <p className="text-gray-500">{user.role} · {user.storeName ?? "Todas las tiendas"}</p>
                  <p className="text-gray-500">{user.email}</p>
                  {user.phone && <p className="text-gray-500">{user.phone}</p>}
                  <button onClick={() => { setEditing(true); setNameDraft(user.name); setPhoneDraft(user.phone ?? ""); }} className="text-[var(--accent,#db2777)] text-xs">
                    Editar mi información
                  </button>
                  <button onClick={logout} className="block w-full text-left text-xs text-gray-500 hover:text-red-600 pt-1 border-t">
                    Cerrar sesión
                  </button>
                </>
              ) : (
                <>
                  <input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} className="w-full border rounded-md px-2 py-1 text-sm" placeholder="Nombre" />
                  <input value={phoneDraft} onChange={(e) => setPhoneDraft(e.target.value)} className="w-full border rounded-md px-2 py-1 text-sm" placeholder="Teléfono" />
                  <p className="text-[11px] text-gray-400">La sede se asigna desde Sedes.</p>
                  <div className="flex gap-2">
                    <button onClick={saveProfile} className="bg-[var(--accent,#db2777)] text-white text-xs rounded-md px-2 py-1">Guardar</button>
                    <button onClick={() => setEditing(false)} className="border text-xs rounded-md px-2 py-1">Cancelar</button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </header>
      <div className="flex flex-1">
        <nav className="hidden sm:block w-48 bg-white border-r p-3 space-y-1">
          {can("pedidos") && (
            <>
              <NavLink to="/catalogo" className={linkClass}>Catálogo</NavLink>
              <NavLink to="/pedidos" className={linkClass}>Pedidos</NavLink>
            </>
          )}
          {can("clientes") && <NavLink to="/clientes" className={linkClass}>Clientes</NavLink>}
          {can("taller") && <NavLink to="/despachos" className={linkClass}>Despachos</NavLink>}
          {can("inventario") && <NavLink to="/inventario" className={linkClass}>Inventario</NavLink>}
          {can("finanzas") && <NavLink to="/finanzas" className={linkClass}>Finanzas</NavLink>}
          {(can("empleados") || can("sedes") || can("horarios") || can("listas") || can("empresa") || can("roles")) && (
            <NavLink to="/administracion" className={linkClass}>Administración</NavLink>
          )}
        </nav>
        <main className="flex-1 p-4 sm:p-6 pb-20 sm:pb-6">
          <Outlet />
        </main>
      </div>
      <nav className="sm:hidden fixed bottom-0 inset-x-0 bg-white border-t flex overflow-x-auto">
        {can("pedidos") && <NavLink to="/catalogo" className="flex-1 text-center py-2 text-xs whitespace-nowrap px-2">Catálogo</NavLink>}
        {can("pedidos") && <NavLink to="/pedidos" className="flex-1 text-center py-2 text-xs whitespace-nowrap px-2">Pedidos</NavLink>}
        {can("clientes") && <NavLink to="/clientes" className="flex-1 text-center py-2 text-xs whitespace-nowrap px-2">Clientes</NavLink>}
        {can("taller") && <NavLink to="/despachos" className="flex-1 text-center py-2 text-xs whitespace-nowrap px-2">Despachos</NavLink>}
        {can("inventario") && <NavLink to="/inventario" className="flex-1 text-center py-2 text-xs whitespace-nowrap px-2">Inventario</NavLink>}
        {can("finanzas") && <NavLink to="/finanzas" className="flex-1 text-center py-2 text-xs whitespace-nowrap px-2">Finanzas</NavLink>}
        {(can("empleados") || can("sedes") || can("horarios") || can("listas") || can("empresa") || can("roles")) && (
          <NavLink to="/administracion" className="flex-1 text-center py-2 text-xs whitespace-nowrap px-2">Admin.</NavLink>
        )}
      </nav>
    </div>
  );
}
