import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `block rounded-lg px-3 py-2 text-sm font-medium ${
    isActive ? "bg-pink-600 text-white" : "text-gray-700 hover:bg-pink-50"
  }`;

export default function DashboardLayout() {
  const { user, stores, currentStoreId, setCurrentStoreId, logout } = useAuth();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold text-pink-700">CFloral</span>
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
        <div className="flex items-center gap-3 text-sm">
          <span className="text-gray-600">{user?.name}</span>
          <button onClick={logout} className="text-pink-700 hover:underline">
            Salir
          </button>
        </div>
      </header>
      <div className="flex flex-1">
        <nav className="w-48 bg-white border-r p-3 space-y-1">
          <NavLink to="/pedidos" className={linkClass}>
            Pedidos
          </NavLink>
          <NavLink to="/clientes" className={linkClass}>
            Clientes
          </NavLink>
          <NavLink to="/inventario" className={linkClass}>
            Inventario
          </NavLink>
        </nav>
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
