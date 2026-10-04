import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import DashboardTab from "./DashboardTab";
import ReportesTab from "./ReportesTab";
import PresupuestosTab from "./PresupuestosTab";
import RecomendacionesTab from "./RecomendacionesTab";
import FacturasTab from "./FacturasTab";
import PagosTab from "./PagosTab";

type Tab = "dashboard" | "reportes" | "presupuestos" | "recomendaciones" | "facturas" | "pagos";

/// Sentinel para "Todas las tiendas" en el selector local de Finanzas (no toca el
/// selector global de tienda del topbar, que sigue usándose para crear registros).
export const ALL_STORES = "__all__";

export default function FinanzasPage() {
  const { can, user, stores, currentStoreId } = useAuth();
  const tabs: Array<[Tab, string]> = [
    ["dashboard", "Dashboard"],
    ["reportes", "Reportes"],
    ["presupuestos", "Presupuestos"],
    ...(can("recomendaciones") ? ([["recomendaciones", "Recomendaciones"]] as Array<[Tab, string]>) : []),
    ["facturas", "Facturas"],
    ["pagos", "Pagos"],
  ];
  const [tab, setTab] = useState<Tab>("dashboard");
  // Igual que el mockup: Admin arranca viendo "Todas las tiendas" por defecto.
  const [scope, setScope] = useState<string>(ALL_STORES);

  const isAdmin = user?.role === "ADMIN";
  // undefined => el servidor agrega entre todas las tiendas (solo Admin puede pedirlo).
  const viewStoreId = isAdmin && scope === ALL_STORES ? undefined : scope || currentStoreId || undefined;
  const goToPresupuesto = () => setTab("presupuestos");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-semibold">Finanzas</h1>
        {isAdmin && stores.length > 1 && (
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">Ver datos de</label>
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              className="border rounded-md px-2 py-1 text-sm"
            >
              <option value={ALL_STORES}>Todas las tiendas</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      <div className="flex gap-2 flex-wrap">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`text-sm rounded-full px-3 py-1.5 ${tab === key ? "bg-pink-600 text-white" : "border hover:bg-pink-50"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "dashboard" && <DashboardTab storeId={viewStoreId} />}
      {tab === "reportes" && <ReportesTab storeId={viewStoreId} onViewBudget={goToPresupuesto} />}
      {tab === "presupuestos" && <PresupuestosTab storeId={viewStoreId} />}
      {tab === "recomendaciones" && <RecomendacionesTab storeId={viewStoreId} onViewBudget={goToPresupuesto} />}
      {tab === "facturas" && <FacturasTab storeId={viewStoreId} />}
      {tab === "pagos" && <PagosTab storeId={viewStoreId} />}
    </div>
  );
}
